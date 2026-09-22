import { computeOrRewards, type GroupOrReward } from "@/lib/or-rewards";
import { getMissionReviewSettings } from "@/lib/mission-settings";
import { notifyReferentStaff, pushNotification } from "@/lib/notifications";
import { emitDiscordEvent } from "@/lib/discord-events";
import { kvRead, kvWrite } from "@/lib/app-kv";

export type StoredMissionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

export type MissionActorTrace = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  at: string;
  /** Temps passé à lire (ms) — visible Lead+ */
  durationMs?: number;
};

export type MissionVoteTrace = MissionActorTrace & {
  decision: "approve" | "reject";
  reason?: string;
};

export type StoredMission = {
  id: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  duration: string;
  groupIds: string[];
  noGroup: boolean;
  status: StoredMissionStatus;
  createdAt: string;
  updatedAt: string;
  authorName?: string | null;
  authorId?: string | null;
  /** Groupe GM (cellule) au nom duquel la mission est postée */
  authorGroupId?: string | null;
  authorGroupName?: string | null;
  orRewards?: GroupOrReward[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reads?: MissionActorTrace[];
  votes?: MissionVoteTrace[];
};

const STORAGE_KEY = "refgm.missions.v1";

function withOrRewards(
  mission: Omit<StoredMission, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): GroupOrReward[] {
  if (mission.orRewards !== undefined) {
    return mission.orRewards;
  }
  return computeOrRewards(
    mission.groupIds,
    mission.duration,
    mission.noGroup
  );
}

export function listMissions(): StoredMission[] {
  const parsed = kvRead<StoredMission[]>(STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((m) => ({
      ...m,
      orRewards: withOrRewards(m),
      reads: Array.isArray(m.reads) ? m.reads : [],
      votes: Array.isArray(m.votes) ? m.votes : [],
    }))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

function writeAll(missions: StoredMission[]) {
  kvWrite(STORAGE_KEY, missions, "refgm:missions-updated");
}

export function saveMission(
  input: Omit<StoredMission, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): StoredMission {
  const now = new Date().toISOString();
  const all = listMissions();
  const existingIndex = input.id
    ? all.findIndex((m) => m.id === input.id)
    : -1;
  const orRewards = withOrRewards(input);

  if (existingIndex >= 0) {
    const prev = all[existingIndex];
    const updated: StoredMission = {
      ...prev,
      ...input,
      orRewards,
      reads: input.reads ?? prev.reads ?? [],
      votes: input.votes ?? prev.votes ?? [],
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: now,
    };
    all[existingIndex] = updated;
    writeAll(all);
    return updated;
  }

  const created: StoredMission = {
    id: crypto.randomUUID(),
    title: input.title,
    descriptionHtml: input.descriptionHtml,
    descriptionText: input.descriptionText,
    duration: input.duration,
    groupIds: input.groupIds,
    noGroup: input.noGroup,
    status: input.status,
    authorName: input.authorName ?? null,
    authorId: input.authorId ?? null,
    authorGroupId: input.authorGroupId ?? null,
    authorGroupName: input.authorGroupName ?? null,
    orRewards,
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
    reads: input.reads ?? [],
    votes: input.votes ?? [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([created, ...all]);
  return created;
}

export function deleteMission(id: string) {
  writeAll(listMissions().filter((m) => m.id !== id));
}

export function remapMissionGroupId(fromId: string, toId: string) {
  if (fromId === toId) return;
  writeAll(
    listMissions().map((m) => ({
      ...m,
      groupIds: m.groupIds.map((id) => (id === fromId ? toId : id)),
      orRewards: m.orRewards?.map((r) =>
        r.groupId === fromId ? { ...r, groupId: toId } : r
      ),
    }))
  );
}

export function getMission(id: string) {
  return listMissions().find((m) => m.id === id) ?? null;
}

export function countDrafts() {
  return listMissions().filter((m) => m.status === "draft").length;
}

export function countPendingMissionReviews() {
  return listMissions().filter((m) => m.status === "pending_review").length;
}

export function formatReadDuration(ms: number | undefined | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "·";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function hasUserReadMission(mission: StoredMission, userId: string) {
  return (mission.reads ?? []).some((r) => r.userId === userId);
}

export function getUserVote(mission: StoredMission, userId: string) {
  return (mission.votes ?? []).find((v) => v.userId === userId) ?? null;
}

export function submitMissionForReview(mission: StoredMission): StoredMission {
  const updated = saveMission({
    ...mission,
    status: "pending_review",
    reviewedBy: null,
    reviewedAt: null,
    reads: [],
    votes: [],
  });
  void notifyReferentStaff({
    type: "mission.pending",
    title: "Nouvelle mission à traiter",
    body: `${updated.title}${updated.authorName ? ` · ${updated.authorName}` : ""}`,
    href: "/dashboard",
    excludeUserId: updated.authorId ?? undefined,
  });
  emitDiscordEvent({
    type: "mission.pending",
    title: updated.title,
    authorName: updated.authorName,
    duration: updated.duration,
  });
  return updated;
}

export function markMissionRead(input: {
  missionId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  durationMs: number;
}): StoredMission | null {
  const current = getMission(input.missionId);
  if (!current || current.status !== "pending_review") return current;
  if (hasUserReadMission(current, input.userId)) return current;

  const read: MissionActorTrace = {
    userId: input.userId,
    displayName: input.displayName.trim() || "Référent",
    avatarUrl: input.avatarUrl?.trim() || null,
    at: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(input.durationMs)),
  };

  return saveMission({
    ...current,
    reads: [...(current.reads ?? []), read],
  });
}

function resolveFromVotes(
  votes: MissionVoteTrace[],
  quorum: number
): "approved" | "rejected" | null {
  const approve = votes.filter((v) => v.decision === "approve").length;
  const reject = votes.filter((v) => v.decision === "reject").length;
  if (approve >= quorum) return "approved";
  if (reject >= quorum) return "rejected";
  return null;
}

export function castMissionVote(input: {
  missionId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  decision: "approve" | "reject";
  reason?: string;
}): { mission: StoredMission | null; resolved: boolean } {
  const current = getMission(input.missionId);
  if (!current || current.status !== "pending_review") {
    return { mission: current, resolved: false };
  }

  const vote: MissionVoteTrace = {
    userId: input.userId,
    displayName: input.displayName.trim() || "Référent",
    avatarUrl: input.avatarUrl?.trim() || null,
    at: new Date().toISOString(),
    decision: input.decision,
    reason: input.reason?.trim() || undefined,
  };

  const others = (current.votes ?? []).filter((v) => v.userId !== input.userId);
  const votes = [...others, vote];
  const quorum = getMissionReviewSettings().voteQuorum;
  const resolved = resolveFromVotes(votes, quorum);

  // En mode vote, on trace aussi une lecture
  const reads = hasUserReadMission(current, input.userId)
    ? current.reads ?? []
    : [
        ...(current.reads ?? []),
        {
          userId: vote.userId,
          displayName: vote.displayName,
          avatarUrl: vote.avatarUrl,
          at: vote.at,
        },
      ];

  if (!resolved) {
    const saved = saveMission({ ...current, votes, reads });
    emitDiscordEvent({
      type: "mission.vote",
      title: current.title,
      decision: input.decision,
      voterName: vote.displayName,
      reason: vote.reason,
    });
    return {
      mission: saved,
      resolved: false,
    };
  }

  const updated = saveMission({
    ...current,
    votes,
    reads,
    status: resolved,
    reviewedBy: `${resolved === "approved" ? "Quorum pour" : "Quorum contre"} (${votes.filter((v) => v.decision === (resolved === "approved" ? "approve" : "reject")).length}/${quorum})`,
    reviewedAt: new Date().toISOString(),
  });

  if (updated.authorId) {
    pushNotification({
      userId: updated.authorId,
      type: resolved === "approved" ? "mission.approved" : "mission.rejected",
      title:
        resolved === "approved" ? "Mission validée" : "Mission refusée",
      body: updated.title,
      href: "/dashboard",
    });
  }
  emitDiscordEvent({
    type: "mission.vote",
    title: updated.title,
    decision: input.decision,
    voterName: vote.displayName,
    reason: vote.reason,
  });
  emitDiscordEvent({
    type: "mission.reviewed",
    title: updated.title,
    decision: resolved,
    reviewerName: vote.displayName,
    authorName: updated.authorName,
  });

  return { mission: updated, resolved: true };
}

/** Validation unitaire (hors mode vote) — après lecture obligatoire */
export function reviewMission(input: {
  missionId: string;
  decision: "approved" | "rejected";
  reviewerId: string;
  reviewerName?: string | null;
  avatarUrl?: string | null;
}): StoredMission | null {
  const current = getMission(input.missionId);
  if (!current || current.status !== "pending_review") return current;

  const reads = hasUserReadMission(current, input.reviewerId)
    ? current.reads ?? []
    : [
        ...(current.reads ?? []),
        {
          userId: input.reviewerId,
          displayName: input.reviewerName?.trim() || "Référent",
          avatarUrl: input.avatarUrl?.trim() || null,
          at: new Date().toISOString(),
        },
      ];

  const updated = saveMission({
    ...current,
    reads,
    status: input.decision,
    reviewedBy: input.reviewerName?.trim() || "Référent",
    reviewedAt: new Date().toISOString(),
  });

  if (updated.authorId) {
    pushNotification({
      userId: updated.authorId,
      type:
        input.decision === "approved"
          ? "mission.approved"
          : "mission.rejected",
      title:
        input.decision === "approved"
          ? "Mission validée"
          : "Mission refusée",
      body: `${updated.title} · ${updated.reviewedBy}`,
      href: "/dashboard",
    });
  }
  emitDiscordEvent({
    type: "mission.reviewed",
    title: updated.title,
    decision: input.decision,
    reviewerName: updated.reviewedBy,
    authorName: updated.authorName,
  });

  return updated;
}

export function sumOrRewards(missions: StoredMission[]) {
  let bleu = 0;
  let rouge = 0;
  for (const mission of missions) {
    for (const reward of mission.orRewards ?? []) {
      if (reward.color === "bleu") bleu += reward.amount;
      else rouge += reward.amount;
    }
  }
  return { bleu, rouge, total: bleu + rouge };
}
