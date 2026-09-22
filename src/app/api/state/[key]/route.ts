import {
  canReadSharedKey,
  canWriteSharedKey,
  requireApprovedActor,
} from "@/lib/server-authorization";
import { SHARED_STORAGE_KEYS } from "@/lib/shared-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";
import { sanitizeSharedPayload } from "@/lib/sanitize-rich-html";
import { canAccessStaffTools, canReadMissions } from "@/lib/permissions";

type Body = { payload?: unknown; expectedRevision?: number };

function knownKey(key: string) {
  return (SHARED_STORAGE_KEYS as readonly string[]).includes(key);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const actor = await requireApprovedActor();
    const { key: encodedKey } = await context.params;
    const key = decodeURIComponent(encodedKey);
    if (!knownKey(key)) {
      return Response.json({ error: "Clé d’état inconnue." }, { status: 404 });
    }
    if (!canWriteSharedKey(actor, key)) {
      return Response.json({ error: "Permission insuffisante." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || !("payload" in body)) {
      return Response.json({ error: "Payload manquant." }, { status: 400 });
    }
    body.payload = sanitizeSharedPayload(key, body.payload);
    if (JSON.stringify(body.payload).length > 1_000_000) return Response.json({ error: "Données trop volumineuses (1 Mo maximum)." }, { status: 413 });

    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin
      .from("refgm_shared_state")
      .select("revision, payload")
      .eq("state_key", key)
      .maybeSingle();
    if (readError) return Response.json({ error: readError.message }, { status: 500 });

    const revision = current?.revision ?? 0;
    if (
      typeof body.expectedRevision === "number" &&
      body.expectedRevision !== revision
    ) {
      return Response.json(
        { error: "Conflit de version.", revision },
        { status: 409 }
      );
    }

    if (key === "refgm.scene-workshops.v1") body.payload = secureWorkshops(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId);
    if (key === "refgm.team-chat.v1") body.payload = secureChat(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId, actor.displayName);
    if (key === "refgm.notifications.v1") {
      const notificationContext = await loadNotificationContext(admin, actor.userId, canAccessStaffTools(actor.grade));
      body.payload = secureNotifications(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId, notificationContext);
    }
    if (key === "refgm.give-requests.v1") body.payload = secureGiveRequests(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId, actor.displayName, canAccessStaffTools(actor.grade));
    if (key === "refgm.missions.v1") {
      let reviewMode: "READ" | "VOTE" = "READ";
      let voteQuorum = 2;
      const { data: settings } = await admin
        .from("refgm_shared_state")
        .select("payload")
        .eq("state_key", "refgm.mission-review-settings.v1")
        .maybeSingle();
      if (settings?.payload && typeof settings.payload === "object") {
        const value = settings.payload as Record<string, unknown>;
        reviewMode = value.reviewMode === "VOTE" ? "VOTE" : "READ";
        voteQuorum = Math.min(10, Math.max(1, Math.floor(Number(value.voteQuorum) || 2)));
      }
      body.payload = secureMissions(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId, actor.displayName, canReadMissions(actor.grade), reviewMode, voteQuorum);
    }
    if (key === "refgm.staff.gm-cells.v1" && !canAccessStaffTools(actor.grade)) body.payload = secureOwnTrame(body.payload, current && "payload" in current ? (current as { payload?: unknown }).payload : undefined, actor.userId);
    const serialized = JSON.stringify(body.payload);
    if (serialized.length > 1_000_000) return Response.json({ error: "L’état fusionné dépasse 1 Mo. Retire des images ou archive d’anciens éléments." }, { status: 413 });
    const { data, error } = await admin.rpc("refgm_put_shared_state", { p_key: key, p_payload: body.payload, p_expected_revision: typeof body.expectedRevision === "number" ? body.expectedRevision : null, p_actor: actor.userId }).single();
    if (error) return Response.json({ error: error.message.includes("revision_conflict") ? "Conflit de version." : error.message, revision }, { status: error.message.includes("revision_conflict") ? 409 : 500 });
    const saved = data as { state_key: string; payload: unknown; revision: number; updated_at: string; updated_by: string };
    const nextRevision = Number(saved.revision);

    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action: "shared_state.updated", entityType: "shared_state", entityId: key, metadata: { revision: nextRevision, bytes: serialized.length } });

    return Response.json({
      record: {
        key: saved.state_key,
        payload: saved.payload,
        revision: saved.revision,
        updatedAt: saved.updated_at,
        updatedBy: saved.updated_by,
      },
    });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "Synchronisation indisponible." }, { status: 503 });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const actor = await requireApprovedActor();
    const { key: encodedKey } = await context.params;
    const key = decodeURIComponent(encodedKey);
    if (!knownKey(key)) return Response.json({ error: "Clé d’état inconnue." }, { status: 404 });
    if (!canReadSharedKey(actor, key)) return Response.json({ error: "Permission insuffisante." }, { status: 403 });
    const { data, error } = await getSupabaseAdmin().from("refgm_shared_state").select("state_key, payload, revision, updated_at, updated_by").eq("state_key", key).maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ record: null }, { headers: { "Cache-Control": "private, no-store" } });
    return Response.json({ record: { key: data.state_key, payload: filterPayload(key, data.payload, actor.userId), revision: data.revision, updatedAt: data.updated_at, updatedBy: data.updated_by } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "Synchronisation indisponible." }, { status: 503 });
  }
}

function filterPayload(key: string, payload: unknown, userId: string) {
  if (!Array.isArray(payload)) return payload;
  if (key === "refgm.notifications.v1") return payload.filter((row) => row && typeof row === "object" && String((row as Record<string, unknown>).userId || (row as Record<string, unknown>).user_id || "") === userId);
  if (key === "refgm.scene-workshops.v1") return payload.filter((row) => { if (!row || typeof row !== "object") return false; const value = row as Record<string, unknown>; return value.ownerId === userId || (Array.isArray(value.collaborators) && value.collaborators.some((member) => member && typeof member === "object" && (member as Record<string, unknown>).userId === userId)); });
  return payload;
}

type NotificationContext = { isStaff: boolean; staffIds: Set<string>; allowedMentionIds: Set<string> };

async function loadNotificationContext(admin: ReturnType<typeof getSupabaseAdmin>, actorId: string, isStaff: boolean): Promise<NotificationContext> {
  if (isStaff) return { isStaff: true, staffIds: new Set(), allowedMentionIds: new Set() };
  const [{ data: accounts }, { data: chatState }] = await Promise.all([
    admin.from("refgm_accounts").select("user_id, grade, status").eq("status", "APPROVED"),
    admin.from("refgm_shared_state").select("payload").eq("state_key", "refgm.team-chat.v1").maybeSingle(),
  ]);
  const staffIds = new Set<string>((accounts ?? []).filter((row: Record<string, unknown>) => canAccessStaffTools(String(row.grade || ""))).map((row: Record<string, unknown>) => String(row.user_id)));
  const allowedMentionIds = new Set<string>();
  for (const message of rows(chatState?.payload)) {
    if (message.authorId !== actorId || !Array.isArray(message.mentionIds)) continue;
    for (const id of message.mentionIds) allowedMentionIds.add(String(id));
  }
  return { isStaff: false, staffIds, allowedMentionIds };
}

function secureNotifications(nextValue: unknown, currentValue: unknown, actorId: string, context: NotificationContext) {
  if (!Array.isArray(nextValue)) return Array.isArray(currentValue) ? currentValue : [];
  const current = Array.isArray(currentValue) ? currentValue : [];
  const proposed = new Map(nextValue.filter((row) => row && typeof row === "object").map((row) => [String((row as Record<string, unknown>).id || ""), row as Record<string, unknown>]));
  const existingIds = new Set<string>();
  const merged = current.map((row) => {
    if (!row || typeof row !== "object") return row;
    const value = row as Record<string, unknown>; const id = String(value.id || ""); existingIds.add(id);
    const next = proposed.get(id);
    if (next && value.userId === actorId) return { ...value, readAt: next.readAt || value.readAt || null };
    return value;
  });
  const allowedTypes = new Set([
    "mission.pending", "mission.approved", "mission.rejected",
    "GIVE_REQUEST", "GIVE_APPROVED", "GIVE_REJECTED", "CHAT_MENTION",
    "PLANNING_ASSIGNED", "PLANNING_REMINDER", "SUPERVISION_TASK",
    "WARNING", "GRADE_CHANGED",
  ]);
  const additions = nextValue
    .filter((row) => row && typeof row === "object" && !existingIds.has(String((row as Record<string, unknown>).id || "")))
    .slice(-30)
    .flatMap((row) => {
      const value = row as Record<string, unknown>;
      const userId = String(value.userId || "").trim().slice(0, 100);
      const title = String(value.title || "").trim().slice(0, 160);
      const type = String(value.type || "").trim().slice(0, 64);
      const href = String(value.href || "").trim().slice(0, 300);
      if (!userId || !title || !allowedTypes.has(type) || (href && !href.startsWith("/dashboard"))) return [];
      if (!context.isStaff) {
        const allowedStaffAlert = (type === "mission.pending" || type === "GIVE_REQUEST") && context.staffIds.has(userId);
        const allowedMention = type === "CHAT_MENTION" && context.allowedMentionIds.has(userId);
        const allowedSelfReminder = type === "PLANNING_REMINDER" && userId === actorId;
        if (!allowedStaffAlert && !allowedMention && !allowedSelfReminder) return [];
      }
      return [{
        id: crypto.randomUUID(),
        userId,
        type,
        title,
        body: String(value.body || "").trim().slice(0, 500),
        href: href || null,
        createdAt: new Date().toISOString(),
        readAt: userId === actorId && value.readAt ? new Date().toISOString() : null,
      }];
    });
  return [...additions, ...merged].slice(0, 1000);
}

function secureChat(nextValue: unknown, currentValue: unknown, actorId: string, actorName: string) {
  if (!Array.isArray(nextValue)) return Array.isArray(currentValue) ? currentValue : [];
  const current = Array.isArray(currentValue) ? currentValue : [];
  const existingIds = new Set(current.map((row) => row && typeof row === "object" ? String((row as Record<string, unknown>).id || "") : ""));
  const additions = nextValue.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const value = row as Record<string, unknown>;
    return !existingIds.has(String(value.id || "")) && value.authorId === actorId && String(value.body || "").trim().length > 0;
  }).slice(-20).map((row) => ({ ...(row as Record<string, unknown>), authorId: actorId, authorName: actorName, body: String((row as Record<string, unknown>).body || "").trim().slice(0, 2000) }));
  return [...current, ...additions].slice(-500);
}

function secureOwnTrame(nextValue: unknown, currentValue: unknown, actorId: string) {
  if (!Array.isArray(nextValue) || !Array.isArray(currentValue)) return currentValue ?? [];
  const editableFields = ["trameLabel", "trameInfo", "trameStatus", "trameProgress", "trameStage", "trameNextStep", "trameUpdatedBy", "trameUpdatedAt"];
  return currentValue.map((currentRow) => {
    if (!currentRow || typeof currentRow !== "object") return currentRow;
    const current = currentRow as Record<string, unknown>;
    const members = Array.isArray(current.members) ? current.members : [];
    const belongsToActor = members.some((member) => member && typeof member === "object" && (member as Record<string, unknown>).userId === actorId);
    if (!belongsToActor) return currentRow;
    const proposed = nextValue.find((row) => row && typeof row === "object" && (row as Record<string, unknown>).id === current.id) as Record<string, unknown> | undefined;
    if (!proposed) return currentRow;
    const merged = { ...current };
    for (const field of editableFields) if (field in proposed) merged[field] = proposed[field];
    return merged;
  });
}

function secureWorkshops(nextValue: unknown, currentValue: unknown, actorId: string) {
  if (!Array.isArray(nextValue)) return Array.isArray(currentValue) ? currentValue : [];
  const current = Array.isArray(currentValue) ? currentValue : [];
  const proposed = rows(nextValue);
  const nextById = new Map(proposed.map((row) => [String(row.id || ""), row]));
  const editableFields = ["title", "summary", "documentHtml", "documentText", "boardItems", "mapItems", "infoBlocks", "connections", "status", "versions"];
  const merged = current.map((row) => {
    if (!row || typeof row !== "object") return row;
    const old = row as Record<string, unknown>;
    const next = nextById.get(String(old.id || ""));
    if (!next) return old;
    const owner = old.ownerId === actorId;
    const editor = owner || (Array.isArray(old.collaborators) && old.collaborators.some((member) => member && typeof member === "object" && (member as Record<string, unknown>).userId === actorId && (member as Record<string, unknown>).permission === "EDIT"));
    if (!editor) return old;
    const safe = { ...old };
    for (const field of editableFields) if (field in next) safe[field] = next[field];
    safe.updatedById = actorId;
    safe.updatedByName = String(next.updatedByName || old.updatedByName || "GameMaster").slice(0, 120);
    safe.updatedAt = new Date().toISOString();
    if (owner) {
      safe.collaborators = rows(next.collaborators).slice(0, 30).map((member) => ({
        userId: String(member.userId || "").slice(0, 100),
        displayName: String(member.displayName || "Utilisateur").slice(0, 120),
        avatarUrl: String(member.avatarUrl || "").slice(0, 1000) || null,
        permission: member.permission === "EDIT" || member.permission === "COMMENT" ? member.permission : "VIEW",
        color: /^#[0-9a-f]{6}$/i.test(String(member.color || "")) ? member.color : "#38bdf8",
      })).filter((member) => member.userId && member.userId !== actorId);
      safe.deletedAt = typeof next.deletedAt === "string" ? next.deletedAt.slice(0, 40) : null;
      safe.deletedById = safe.deletedAt ? actorId : null;
    }
    return safe;
  });
  const existingIds = new Set(current.filter((row) => row && typeof row === "object").map((row) => String((row as Record<string, unknown>).id || "")));
  const additions = proposed.filter((row) => !existingIds.has(String(row.id || "")) && row.ownerId === actorId).slice(-10).map((row) => ({ ...row, ownerId: actorId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedById: actorId, deletedAt: null, deletedById: null }));
  return [...additions, ...merged].slice(0, 200);
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
}

function secureGiveRequests(nextValue: unknown, currentValue: unknown, actorId: string, actorName: string, isStaff: boolean) {
  const current = rows(currentValue);
  const proposed = rows(nextValue);
  const nextById = new Map(proposed.map((row) => [String(row.id || ""), row]));
  const existingIds = new Set(current.map((row) => String(row.id || "")));
  const kept = current.flatMap((old) => {
    const next = nextById.get(String(old.id || ""));
    if (!next) return isStaff ? [] : [old];
    if (!isStaff) return [old];
    const status = next.status === "APPROVED" || next.status === "REJECTED" ? next.status : old.status;
    return [{ ...old, status, reviewNote: String(next.reviewNote || "").slice(0, 2000), reviewerId: actorId, reviewerName: actorName, reviewedAt: status === old.status ? old.reviewedAt : new Date().toISOString() }];
  });
  const additions = proposed.filter((row) => !existingIds.has(String(row.id || "")) && row.requesterId === actorId).slice(-10).map((row) => {
    const commandType = row.commandType === "GiveItemOffline2" ? "GiveItemOffline2" : "GiveItem";
    const itemName = String(row.itemName || "").trim().slice(0, 120);
    const quantity = Math.max(1, Math.min(10000, Math.floor(Number(row.quantity) || 1)));
    const reason = String(row.reason || "").trim().slice(0, 1000);
    const uniqueId = String(row.uniqueId || "").trim().slice(0, 100);
    const characterId = String(row.characterId || "").trim().slice(0, 100);
    const commandId = commandType === "GiveItemOffline2" ? uniqueId : characterId;
    return { ...row, itemName, quantity, reason, commandType, uniqueId, characterId, generatedCommand: `/${commandType} ${itemName} ${quantity} ${commandId} ${reason}`, requesterId: actorId, requesterName: actorName, status: "PENDING", reviewerId: null, reviewerName: null, reviewNote: "", reviewedAt: null };
  });
  return [...additions, ...kept].slice(0, 2000);
}

function secureMissions(nextValue: unknown, currentValue: unknown, actorId: string, actorName: string, isReviewer: boolean, reviewMode: "READ" | "VOTE", voteQuorum: number) {
  const current = rows(currentValue);
  const proposed = rows(nextValue);
  const nextById = new Map(proposed.map((row) => [String(row.id || ""), row]));
  const existingIds = new Set(current.map((row) => String(row.id || "")));
  const kept = current.flatMap((old) => {
    const next = nextById.get(String(old.id || ""));
    if (!next) return old.authorId === actorId && ["draft", "rejected"].includes(String(old.status)) ? [] : [old];
    if (isReviewer) {
      if (old.status !== "pending_review") return [old];
      const now = new Date().toISOString();
      const oldReads = rows(old.reads);
      const proposedReads = rows(next.reads);
      const ownRead = proposedReads.find((read) => read.userId === actorId);
      const readsWithoutActor = oldReads.filter((read) => read.userId !== actorId);
      const safeReads = ownRead
        ? [...readsWithoutActor, {
            userId: actorId,
            displayName: actorName,
            avatarUrl: String(ownRead.avatarUrl || "").slice(0, 1000) || null,
            at: String(ownRead.at || now).slice(0, 40),
            durationMs: Math.max(0, Math.min(3_600_000, Math.round(Number(ownRead.durationMs) || 0))),
          }]
        : oldReads;

      const oldVotes = rows(old.votes);
      const proposedVotes = rows(next.votes);
      const ownVote = proposedVotes.find((vote) => vote.userId === actorId);
      const votesWithoutActor = oldVotes.filter((vote) => vote.userId !== actorId);
      const safeVotes = ownVote && (ownVote.decision === "approve" || ownVote.decision === "reject")
        ? [...votesWithoutActor, {
            userId: actorId,
            displayName: actorName,
            avatarUrl: String(ownVote.avatarUrl || "").slice(0, 1000) || null,
            at: now,
            decision: ownVote.decision,
            reason: String(ownVote.reason || "").trim().slice(0, 2000) || undefined,
          }]
        : oldVotes;

      let status = "pending_review";
      if (reviewMode === "VOTE") {
        const approvals = safeVotes.filter((vote) => vote.decision === "approve").length;
        const rejections = safeVotes.filter((vote) => vote.decision === "reject").length;
        if (approvals >= voteQuorum) status = "approved";
        else if (rejections >= voteQuorum) status = "rejected";
      } else if (safeReads.some((read) => read.userId === actorId) && (next.status === "approved" || next.status === "rejected")) {
        status = next.status;
      }

      return [{
        ...old,
        reads: safeReads,
        votes: safeVotes,
        status,
        reviewedBy: status === "pending_review" ? old.reviewedBy : actorName,
        reviewedAt: status === "pending_review" ? old.reviewedAt : now,
        updatedAt: status === old.status && safeReads === oldReads && safeVotes === oldVotes ? old.updatedAt : now,
      }];
    }
    if (old.authorId !== actorId || (old.status !== "draft" && old.status !== "rejected")) return [old];
    const safeStatus = next.status === "pending_review" ? "pending_review" : "draft";
    return [{ ...next, id: old.id, authorId: actorId, authorName: actorName, createdAt: old.createdAt, status: safeStatus, reads: old.reads || [], votes: old.votes || [], reviewedBy: old.reviewedBy || null, reviewedAt: old.reviewedAt || null }];
  });
  const additions = proposed.filter((row) => !existingIds.has(String(row.id || "")) && row.authorId === actorId).slice(-10).map((row) => ({ ...row, authorId: actorId, authorName: actorName, status: row.status === "pending_review" ? "pending_review" : "draft", reads: [], votes: [], reviewedBy: null, reviewedAt: null }));
  return [...additions, ...kept].slice(0, 2000);
}

