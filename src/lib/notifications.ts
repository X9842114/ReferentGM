import { kvRead, kvWrite } from "@/lib/app-kv";
import { getAccountPrefs } from "@/lib/account-prefs";
import { getGradeDef } from "@/lib/grade-registry";
import { listAllAccounts } from "@/lib/accounts";
import { normalizeGrade } from "@/lib/grades";

export type SiteNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

const KEY = "refgm.notifications.v1";

function readAll(): SiteNotification[] {
  const parsed = kvRead<SiteNotification[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(rows: SiteNotification[]) {
  kvWrite(KEY, rows.slice(0, 400), "refgm:notifications-updated");
}

function uid() {
  return crypto.randomUUID();
}

export function listNotificationsFor(userId: string): SiteNotification[] {
  return readAll()
    .filter((n) => n.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function countUnreadNotifications(userId: string) {
  return listNotificationsFor(userId).filter((n) => !n.readAt).length;
}

export function pushNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  href?: string | null;
}): SiteNotification | null {
  if (!input.userId || !input.title.trim()) return null;
  const prefs = getAccountPrefs(input.userId);
  if (input.type.startsWith("planning.") && !prefs.notifyPlanning) return null;
  if (input.type.startsWith("account.") && !prefs.notifyAccounts) return null;
  const row: SiteNotification = {
    id: uid(),
    userId: input.userId,
    type: input.type.slice(0, 64),
    title: input.title.slice(0, 160),
    body: (input.body ?? "").slice(0, 500),
    href: input.href?.slice(0, 300) ?? null,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  writeAll([row, ...readAll()]);
  return row;
}

export function pushNotifications(
  userIds: string[],
  payload: Omit<Parameters<typeof pushNotification>[0], "userId">
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    pushNotification({ ...payload, userId });
  }
  return unique.length;
}

export function markNotificationRead(id: string, userId: string) {
  const all = readAll();
  const idx = all.findIndex((n) => n.id === id && n.userId === userId);
  if (idx < 0) return;
  if (all[idx].readAt) return;
  all[idx] = { ...all[idx], readAt: new Date().toISOString() };
  writeAll(all);
}

export function markAllNotificationsRead(userId: string) {
  const now = new Date().toISOString();
  writeAll(
    readAll().map((n) =>
      n.userId === userId && !n.readAt ? { ...n, readAt: now } : n
    )
  );
}

/** Notifie tous les comptes approuvés référents / dev (lecture missions). */
export async function notifyReferentStaff(payload: {
  type: string;
  title: string;
  body?: string;
  href?: string | null;
  excludeUserId?: string;
}) {
  const accounts = await listAllAccounts();
  const ids = accounts
    .filter((a) => {
      if (a.status !== "APPROVED") return false;
      if (payload.excludeUserId && a.userId === payload.excludeUserId)
        return false;
      const def = getGradeDef(normalizeGrade(a.grade));
      return def.kind === "REFERENT" || def.kind === "DEV";
    })
    .map((a) => a.userId);
  return pushNotifications(ids, payload);
}

/** Préviens tous les comptes DEVELOPPEUR. */
export async function notifyDevelopers(payload: {
  type: string;
  title: string;
  body?: string;
  href?: string | null;
  excludeUserId?: string;
}) {
  const accounts = await listAllAccounts();
  const ids = accounts
    .filter((a) => {
      if (a.status !== "APPROVED") return false;
      if (payload.excludeUserId && a.userId === payload.excludeUserId)
        return false;
      const def = getGradeDef(normalizeGrade(a.grade));
      return def.kind === "DEV" || a.grade === "DEVELOPPEUR";
    })
    .map((a) => a.userId);
  return pushNotifications(ids, payload);
}
