function onClient() {
  return typeof window !== "undefined";
}

const EVENTS = [
  "refgm:staff-updated",
  "refgm:missions-updated",
  "refgm:accounts-updated",
  "refgm:profile-updated",
  "refgm:notifications-updated",
  "refgm:dev-feedback-updated",
  "refgm:discord-missions-updated",
  "refgm:group-rewards-updated",
  "refgm:mission-settings-updated",
  "refgm:planning-updated",
  "refgm:prefs-updated",
  "refgm:roadmap-updated",
  "refgm:rp-groups-updated",
  "refgm:chat-updated",
  "refgm:scene-workshops-updated",
] as const;

function persistToDisk(key: string, value: unknown) {
  if (!onClient()) return;
  const body = JSON.stringify({ key, value });
  const send = () =>
    fetch("/api/local-kv", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body,
    }).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
    });
  void send().catch(() => {
    window.setTimeout(() => {
      void send().catch(() => {});
    }, 800);
  });
}

export function kvRead<T>(key: string, fallback: T): T {
  if (!onClient()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function kvWrite(key: string, value: unknown, event?: string) {
  if (onClient()) {
    localStorage.setItem(key, JSON.stringify(value));
    if (event) window.dispatchEvent(new Event(event));
  }
  persistToDisk(key, value);
}

export function dumpBrowserCache(): Record<string, unknown> {
  if (!onClient()) return {};
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("refgm.")) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      dump[key] = JSON.parse(raw);
    } catch {
      dump[key] = raw;
    }
  }
  return dump;
}

/** La base serveur met à jour le cache. On n’efface pas les clés locales : un dump incomplet ne doit pas vider le QG. */
export function applyServerSnapshot(entries: Record<string, unknown>) {
  if (!onClient()) return;
  let changed = false;
  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith("refgm.")) continue;
    const next = JSON.stringify(value);
    if (localStorage.getItem(key) === next) continue;
    localStorage.setItem(key, next);
    changed = true;
  }
  if (!changed) return;
  for (const event of EVENTS) {
    window.dispatchEvent(new Event(event));
  }
}

export function hydrateLocalStorage(entries: Record<string, unknown>) {
  applyServerSnapshot(entries);
}
