import { kvRead, kvWrite } from "@/lib/app-kv";
import { RP_GROUPS } from "@/lib/rp-groups";

export type WeeklyGroupAssignment = {
  weekKey: string;
  userId: string;
  displayName: string;
  groupIds: string[];
  assignedAt: string;
};

export type WeeklyGroupRotation = {
  enabled: boolean;
  groupsPerGm: number;
  currentWeek: string;
  assignments: WeeklyGroupAssignment[];
  historyByUser: Record<string, string[]>;
  updatedAt: string;
  updatedBy: string;
};

const KEY = "refgm.gm-weekly-groups.v1";

export function getIsoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function readWeeklyRotation(): WeeklyGroupRotation {
  const fallback: WeeklyGroupRotation = { enabled: false, groupsPerGm: 1, currentWeek: "", assignments: [], historyByUser: {}, updatedAt: "", updatedBy: "" };
  const value = kvRead<Partial<WeeklyGroupRotation> | null>(KEY, null);
  if (!value || typeof value !== "object") return fallback;
  return { ...fallback, ...value, groupsPerGm: Math.max(1, Math.min(3, Number(value.groupsPerGm) || 1)), assignments: Array.isArray(value.assignments) ? value.assignments : [], historyByUser: value.historyByUser && typeof value.historyByUser === "object" ? value.historyByUser : {} };
}

function writeRotation(value: WeeklyGroupRotation) {
  kvWrite(KEY, value, "refgm:staff-updated");
  return value;
}

function stableScore(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function configureWeeklyRotation(input: { enabled: boolean; groupsPerGm: number; actorName: string }) {
  const current = readWeeklyRotation();
  return writeRotation({ ...current, enabled: input.enabled, groupsPerGm: Math.max(1, Math.min(3, Math.floor(input.groupsPerGm))), updatedAt: new Date().toISOString(), updatedBy: input.actorName });
}

export function generateWeeklyRotation(gms: { userId: string; displayName: string }[], actorName: string, force = false) {
  const current = readWeeklyRotation();
  const weekKey = getIsoWeekKey();
  if (!current.enabled || (!force && current.currentWeek === weekKey)) return current;
  const allIds = RP_GROUPS.map((group) => group.id);
  const history = { ...current.historyByUser };
  const now = new Date().toISOString();
  const assignments = gms.map((gm) => {
    let seen = [...new Set((history[gm.userId] || []).filter((id) => allIds.includes(id)))];
    let available = allIds.filter((id) => !seen.includes(id));
    if (available.length < current.groupsPerGm) { seen = []; available = [...allIds]; }
    available.sort((a, b) => stableScore(`${weekKey}:${gm.userId}:${a}`) - stableScore(`${weekKey}:${gm.userId}:${b}`));
    const groupIds = available.slice(0, current.groupsPerGm);
    history[gm.userId] = [...seen, ...groupIds];
    return { weekKey, userId: gm.userId, displayName: gm.displayName, groupIds, assignedAt: now };
  });
  return writeRotation({ ...current, currentWeek: weekKey, assignments, historyByUser: history, updatedAt: now, updatedBy: actorName });
}

export function resetWeeklyRotationHistory(actorName: string) {
  const current = readWeeklyRotation();
  return writeRotation({ ...current, currentWeek: "", assignments: [], historyByUser: {}, updatedAt: new Date().toISOString(), updatedBy: actorName });
}
