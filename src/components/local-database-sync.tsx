"use client";

import { applyServerSnapshot, dumpBrowserCache, kvWrite } from "@/lib/app-kv";
import { useEffect, useState, type ReactNode } from "react";

const POLL_MS = 12000;

function isKvPayload(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key.startsWith("refgm."))) return true;
  return keys.length === 0 || typeof record.error !== "string";
}

const SKIP_PUSH = new Set([
  "refgm.presence.v1",
  "refgm.shared-state.meta.v1",
  "refgm.shared-state.conflict-backups.v1",
]);

async function pushLocalDiff(server: Record<string, unknown>) {
  const dump = dumpBrowserCache();
  const entries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dump)) {
    if (!key.startsWith("refgm.") || SKIP_PUSH.has(key)) continue;
    if (JSON.stringify(server[key]) === JSON.stringify(value)) continue;
    entries[key] = value;
  }
  if (Object.keys(entries).length === 0) return false;
  const res = await fetch("/api/local-kv", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  return res.ok;
}

async function hydrateSqlCaches() {
  try {
    const accountsRes = await fetch("/api/accounts?list=1", { cache: "no-store" });
    if (accountsRes.ok) {
      const body = (await accountsRes.json()) as { accounts?: unknown[] };
      if (Array.isArray(body.accounts)) {
        const dir: Record<string, unknown> = {};
        for (const row of body.accounts) {
          if (!row || typeof row !== "object") continue;
          const item = row as Record<string, unknown>;
          const userId = String(item.user_id || item.userId || "");
          if (!userId) continue;
          dir[userId] = {
            userId,
            displayName: item.display_name || item.displayName || "Référent GM",
            discordAvatarUrl: item.discord_avatar_url || item.discordAvatarUrl || "",
            discordLinked: Boolean(item.discord_linked ?? item.discordLinked),
            status: item.status || "PENDING",
            grade: item.grade || "GAMEMASTER",
            createdAt: item.created_at || item.createdAt,
            updatedAt: item.updated_at || item.updatedAt,
            reviewedBy: item.reviewed_by ?? item.reviewedBy ?? null,
            reviewedAt: item.reviewed_at ?? item.reviewedAt ?? null,
          };
        }
        if (Object.keys(dir).length > 0) {
          kvWrite("refgm.accounts.v1", dir, "refgm:accounts-updated");
        }
      }
    }
  } catch {
    /* accounts SQL optionnels au premier login */
  }

  try {
    const profilesRes = await fetch("/api/profiles", { cache: "no-store" });
    if (!profilesRes.ok) return;
    const body = (await profilesRes.json()) as { profiles?: Array<Record<string, unknown>> };
    if (!Array.isArray(body.profiles) || body.profiles.length === 0) return;
    const dir: Record<string, unknown> = {};
    for (const row of body.profiles) {
      const userId = String(row.user_id || row.userId || "");
      if (!userId) continue;
      dir[userId] = {
        userId,
        uniqueId: row.unique_id || row.uniqueId || userId,
        displayName: row.display_name || row.displayName || "Référent GM",
        bio: row.bio || "",
        bannerDataUrl: row.banner_data_url || row.bannerDataUrl || "",
        discordAvatarUrl: row.discord_avatar_url || row.discordAvatarUrl || "",
        discordLinked: Boolean(row.discord_linked ?? row.discordLinked),
        hasIgPerms: Boolean(row.has_ig_perms ?? row.hasIgPerms),
        accent: row.accent || "#38bdf8",
        updatedAt: row.updated_at || row.updatedAt,
        manualBadges: row.manual_badges || row.manualBadges || [],
      };
    }
    kvWrite("refgm.profiles.directory.v1", dir, "refgm:profile-updated");
  } catch {
    /* profils SQL optionnels */
  }
}

/**
 * Source de vérité = la base. On n’affiche le QG qu’après le premier pull.
 */
export function LocalDatabaseSync({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stamp = "";
    let busy = false;

    const pull = async (seedIfEmpty: boolean) => {
      if (busy || cancelled) return false;
      busy = true;
      try {
        if (!seedIfEmpty && stamp) {
          const check = await fetch("/api/local-kv?stamp=1", { cache: "no-store" });
          if (!check.ok || cancelled) return false;
          const body = (await check.json()) as { stamp?: string };
          if (body.stamp === stamp) return true;
        }
        const res = await fetch("/api/local-kv", { cache: "no-store" });
        if (!res.ok || cancelled) return false;
        const entries = (await res.json()) as unknown;
        if (cancelled || !isKvPayload(entries)) return false;
        applyServerSnapshot(entries);
        const uploaded = await pushLocalDiff(entries);
        if (uploaded) stamp = "";
        else {
          const stamped = await fetch("/api/local-kv?stamp=1", { cache: "no-store" });
          if (stamped.ok) {
            const body = (await stamped.json()) as { stamp?: string };
            stamp = body.stamp || stamp;
          }
        }
        if (seedIfEmpty) await hydrateSqlCaches();
        return true;
      } finally {
        busy = false;
      }
    };

    void (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        const ok = await pull(true).catch(() => false);
        if (ok) break;
        await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
      }
      if (!cancelled) setReady(true);
    })();

    const beat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void pull(false).catch(() => {
        /* hors ligne */
      });
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void pull(false).catch(() => {});
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(beat);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-white/45">
        Synchronisation…
      </div>
    );
  }

  return children;
}
