import { kvRead, kvWrite } from "@/lib/app-kv";
import { logActivity } from "@/lib/staff-storage";
import { notifyReferentStaff, pushNotification } from "@/lib/notifications";

export type GiveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GiveCommandType = "GiveItem" | "GiveItemOffline2";

export type GiveRequest = {
  id: string;
  itemName: string;
  wikiName: string;
  quantity: number;
  reason: string;
  commandType?: GiveCommandType;
  uniqueId?: string;
  characterId?: string;
  generatedCommand?: string;
  targetLabel: string;
  targetId?: string;
  targetType?: "GROUP" | "MEMBER" | "OTHER";
  status: GiveRequestStatus;
  requesterId: string;
  requesterName: string;
  gmGroupName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewNote: string;
  createdAt: string;
  reviewedAt: string | null;
};

const KEY = "refgm.give-requests.v1";
const LEGACY_KEY = "refgm.staff.give-requests.v1";

function readJson<T>(key: string, fallback: T): T {
  return kvRead(key, fallback);
}

function writeJson(key: string, value: unknown) {
  kvWrite(key, value, "refgm:staff-updated");
}

function uid() {
  return crypto.randomUUID();
}

export function listGiveRequests(): GiveRequest[] {
  const current = readJson<GiveRequest[]>(KEY, []);
  const rows = current.length ? current : readJson<GiveRequest[]>(LEGACY_KEY, []);
  if (!current.length && rows.length) writeJson(KEY, rows);
  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listPendingGiveRequests(): GiveRequest[] {
  return listGiveRequests().filter((r) => r.status === "PENDING");
}

export function countPendingGiveRequests(): number {
  return listPendingGiveRequests().length;
}

export function createGiveRequest(input: {
  itemName: string;
  wikiName?: string;
  quantity: number;
  reason: string;
  commandType?: GiveCommandType;
  uniqueId?: string;
  characterId?: string;
  targetLabel?: string;
  targetId?: string;
  targetType?: "GROUP" | "MEMBER" | "OTHER";
  requesterId: string;
  requesterName: string;
  gmGroupName?: string | null;
}): GiveRequest {
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const commandType = input.commandType ?? "GiveItem";
  const targetCommandId = commandType === "GiveItemOffline2" ? input.uniqueId?.trim() : input.characterId?.trim();
  const generatedCommand = `/${commandType} ${input.itemName.trim()} ${qty} ${targetCommandId || "ID_MANQUANT"} ${input.reason.trim()}`;
  const row: GiveRequest = {
    id: uid(),
    itemName: input.itemName.trim(),
    wikiName: (input.wikiName ?? "").trim(),
    quantity: qty,
    reason: input.reason.trim(),
    commandType,
    uniqueId: input.uniqueId?.trim() || undefined,
    characterId: input.characterId?.trim() || undefined,
    generatedCommand,
    targetLabel: (input.targetLabel ?? "").trim(),
    targetId: input.targetId?.trim() || undefined,
    targetType: input.targetType ?? "OTHER",
    status: "PENDING",
    requesterId: input.requesterId,
    requesterName: input.requesterName.trim() || "GameMaster",
    gmGroupName: input.gmGroupName?.trim() || null,
    reviewerId: null,
    reviewerName: null,
    reviewNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  writeJson(KEY, [row, ...listGiveRequests()]);
  logActivity({
    action: "give-request.created",
    details: `${row.itemName} ×${row.quantity} · ${row.requesterName}`,
    actorId: row.requesterId,
    actorName: row.requesterName,
  });
  void notifyReferentStaff({ type: "GIVE_REQUEST", title: `Nouvelle demande de Give · ${row.itemName} ×${row.quantity}`, body: `${row.requesterName}${row.targetLabel ? ` pour ${row.targetLabel}` : ""} · ${row.reason}`, href: "/dashboard/demandes-give", excludeUserId: row.requesterId });
  return row;
}

export function reviewGiveRequest(input: {
  id: string;
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
  reviewerId: string;
  reviewerName: string;
}): GiveRequest | null {
  const list = listGiveRequests();
  const idx = list.findIndex((r) => r.id === input.id);
  if (idx < 0) return null;
  const prev = list[idx];
  if (prev.status !== "PENDING") return prev;

  const next: GiveRequest = {
    ...prev,
    status: input.status,
    reviewNote: (input.reviewNote ?? "").trim(),
    reviewerId: input.reviewerId,
    reviewerName: input.reviewerName.trim() || "Référent",
    reviewedAt: new Date().toISOString(),
  };
  list[idx] = next;
  writeJson(KEY, list);
  logActivity({
    action:
      input.status === "APPROVED"
        ? "give-request.approved"
        : "give-request.rejected",
    details: `${next.itemName} ×${next.quantity} · ${next.requesterName}`,
    actorId: input.reviewerId,
    actorName: input.reviewerName,
  });
  pushNotification({ userId: next.requesterId, type: input.status === "APPROVED" ? "GIVE_APPROVED" : "GIVE_REJECTED", title: input.status === "APPROVED" ? `Give approuvé · ${next.itemName} ×${next.quantity}` : `Give refusé · ${next.itemName} ×${next.quantity}`, body: next.reviewNote ? `${next.reviewerName} : ${next.reviewNote}` : `Décision prise par ${next.reviewerName}.`, href: "/dashboard/demandes-give" });
  return next;
}

export function deleteGiveRequest(id: string) {
  writeJson(
    KEY,
    listGiveRequests().filter((r) => r.id !== id)
  );
}
