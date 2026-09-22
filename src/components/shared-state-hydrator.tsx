"use client";

import { readSharedLocalValue, SHARED_STATE_EVENTS, SHARED_STORAGE_KEYS, type SharedStateRecord } from "@/lib/shared-state";
import { useEffect } from "react";

const META_KEY = "refgm.shared-state.meta.v1";
const CONFLICT_BACKUP_KEY = "refgm.shared-state.conflict-backups.v1";
const REVISION_CHECK_MS = 60_000;
type RevisionMap = Record<string, number>;
type ConflictBackup = { key: string; payload: unknown; detectedAt: string };

function reportSync(status: "saving" | "saved" | "conflict" | "error", message?: string) {
  window.dispatchEvent(new CustomEvent("refgm:sync-status", { detail: { status, message, at: Date.now() } }));
}

function readRevisions(): RevisionMap {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") as RevisionMap; } catch { return {}; }
}

function preserveConflict(key: string, payload: unknown) {
  let backups: ConflictBackup[] = [];
  try { backups = JSON.parse(localStorage.getItem(CONFLICT_BACKUP_KEY) || "[]") as ConflictBackup[]; } catch { /* une sauvegarde corrompue ne doit pas bloquer la synchronisation */ }
  backups.unshift({ key, payload, detectedAt: new Date().toISOString() });
  localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify(backups.slice(0, 20)));
}

function mergeConflictPayload(localValue: unknown, remoteValue: unknown) {
  if (!Array.isArray(localValue) || !Array.isArray(remoteValue)) return remoteValue;
  const getId = (row: unknown) => row && typeof row === "object" ? String((row as Record<string, unknown>).id || "") : "";
  const getUpdatedAt = (row: unknown) => row && typeof row === "object" ? Date.parse(String((row as Record<string, unknown>).updatedAt || (row as Record<string, unknown>).createdAt || "")) || 0 : 0;
  const merged = new Map<string, unknown>();
  for (const row of remoteValue) { const id = getId(row); if (id) merged.set(id, row); }
  for (const row of localValue) {
    const id = getId(row);
    if (!id) continue;
    const remote = merged.get(id);
    if (!remote || getUpdatedAt(row) > getUpdatedAt(remote)) merged.set(id, row);
  }
  return [...merged.values()];
}

function emitSharedUpdates() {
  window.dispatchEvent(new Event("refgm:missions-updated"));
  window.dispatchEvent(new Event("refgm:staff-updated"));
  window.dispatchEvent(new Event("refgm:notifications-updated"));
  window.dispatchEvent(new Event("refgm:chat-updated"));
}

export function SharedStateHydrator() {
  useEffect(() => {
    let stopped = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    let checking = false;
    let lastCheck = 0;
    const revisions = readRevisions();
    const snapshots = new Map<string, string | null>(SHARED_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]));
    const saveRevisions = () => localStorage.setItem(META_KEY, JSON.stringify(revisions));

    function applyRecord(record: SharedStateRecord) {
      const serialized = JSON.stringify(record.payload);
      localStorage.setItem(record.key, serialized);
      snapshots.set(record.key, serialized);
      revisions[record.key] = record.revision;
    }

    async function fetchKey(key: string) {
      const response = await fetch(`/api/state/${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!response.ok || stopped) return false;
      const body = await response.json() as { record: SharedStateRecord | null };
      if (!body.record) return false;
      applyRecord(body.record);
      return body.record;
    }

    async function pushKey(key: string, retry = true) {
      reportSync("saving");
      const localValue = readSharedLocalValue(key);
      try {
        const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: localValue, expectedRevision: revisions[key] ?? 0 }),
        });
        const body = await response.json().catch(() => null) as { record?: SharedStateRecord; revision?: number; error?: string } | null;
        if (response.ok && body?.record) {
          applyRecord(body.record);
          saveRevisions();
          reportSync("saved");
        } else if (response.status === 409) {
          preserveConflict(key, localValue);
          revisions[key] = body?.revision ?? revisions[key] ?? 0;
          saveRevisions();
          const remote = await fetchKey(key);
          if (remote) {
            const merged = mergeConflictPayload(localValue, remote.payload);
            localStorage.setItem(key, JSON.stringify(merged));
            saveRevisions();
            emitSharedUpdates();
            if (retry && Array.isArray(localValue) && Array.isArray(remote.payload)) {
              await pushKey(key, false);
              return;
            }
          }
          reportSync("conflict", "Conflit détecté : une copie locale a été conservée et les données les plus récentes ont été récupérées.");
        } else reportSync("error", body?.error || "La sauvegarde n’a pas abouti.");
      } catch {
        reportSync("error", "Connexion perdue : tes changements restent sur cet appareil.");
      }
    }

    function schedulePush() {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        const changedKeys = SHARED_STORAGE_KEYS.filter((key) => {
          const current = localStorage.getItem(key);
          return current !== null && current !== snapshots.get(key);
        });
        void Promise.all(changedKeys.map((key) => pushKey(key)));
      }, 800);
    }

    async function initialHydrate() {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok || stopped) return;
      const body = await response.json() as { records: SharedStateRecord[] };
      const remoteKeys = new Set<string>();
      for (const record of body.records) { remoteKeys.add(record.key); applyRecord(record); }
      saveRevisions();
      const localOnly = SHARED_STORAGE_KEYS.filter((key) => !remoteKeys.has(key) && localStorage.getItem(key) !== null);
      await Promise.all(localOnly.map((key) => pushKey(key)));
      if (!stopped && body.records.length) emitSharedUpdates();
    }

    async function checkRevisions() {
      if (checking || stopped || document.visibilityState !== "visible") return;
      checking = true;
      lastCheck = Date.now();
      try {
        const response = await fetch("/api/state?revisions=1", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const body = await response.json() as { revisions: RevisionMap };
        const changedKeys = Object.entries(body.revisions).filter(([key, revision]) => revision > (revisions[key] ?? 0)).map(([key]) => key);
        const changed = (await Promise.all(changedKeys.map(fetchKey))).some(Boolean);
        saveRevisions();
        if (changed && !stopped) emitSharedUpdates();
      } finally { checking = false; }
    }

    const warmCache = Object.keys(revisions).length > 0 && SHARED_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
    if (warmCache) void checkRevisions(); else void initialHydrate();
    const revisionInterval = window.setInterval(() => void checkRevisions(), REVISION_CHECK_MS);
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - lastCheck >= REVISION_CHECK_MS) void checkRevisions(); };
    for (const event of SHARED_STATE_EVENTS) window.addEventListener(event, schedulePush);
    window.addEventListener("storage", schedulePush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(revisionInterval);
      if (pushTimer) clearTimeout(pushTimer);
      for (const event of SHARED_STATE_EVENTS) window.removeEventListener(event, schedulePush);
      window.removeEventListener("storage", schedulePush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
