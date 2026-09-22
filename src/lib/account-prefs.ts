import { kvRead, kvWrite } from "@/lib/app-kv";

export type AccountPrefs = {
  notifyPlanning: boolean;
  notifyAccounts: boolean;
};

const KEY = "refgm.account-prefs.v1";

function empty(): Record<string, AccountPrefs> {
  return {};
}

export function defaultAccountPrefs(): AccountPrefs {
  return {
    notifyPlanning: true,
    notifyAccounts: true,
  };
}

export function getAccountPrefs(userId: string): AccountPrefs {
  const id = userId.trim();
  if (!id) return defaultAccountPrefs();
  const all = kvRead<Record<string, AccountPrefs>>(KEY, empty());
  return { ...defaultAccountPrefs(), ...(all[id] ?? {}) };
}

export function saveAccountPrefs(userId: string, prefs: AccountPrefs) {
  const id = userId.trim();
  if (!id) return defaultAccountPrefs();
  const all = kvRead<Record<string, AccountPrefs>>(KEY, empty());
  const next = { ...defaultAccountPrefs(), ...prefs };
  all[id] = next;
  kvWrite(KEY, all, "refgm:prefs-updated");
  return next;
}
