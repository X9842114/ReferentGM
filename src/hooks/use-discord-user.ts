"use client";

import { useEffect, useState } from "react";

export type DiscordLookup = {
  id: string;
  username: string;
  handle: string;
  avatarUrl: string;
  bannerUrl: string | null;
  decorationUrl: string | null;
  accent: string | null;
  inGuild: boolean;
  nick: string | null;
  roles: { id: string; name: string; color: string | null }[];
  grade: string | null;
  status: "loading" | "ready" | "missing";
};

export function parseDiscordId(raw: unknown) {
  const compact = String(raw ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s/g, "");
  const mention = compact.match(/<@!?(\d{17,20})>/);
  if (mention?.[1]) return mention[1];
  const match = compact.match(/(\d{17,20})/);
  return match?.[1] ?? compact.replace(/\D/g, "");
}

export function isDiscordSnowflake(value?: unknown) {
  const id =
    typeof value === "string" || typeof value === "number"
      ? parseDiscordId(value)
      : String(value ?? "").trim();
  return /^\d{17,20}$/.test(id);
}

function isRealName(name?: string | null) {
  const n = (name ?? "").trim();
  return Boolean(n) && !isDiscordSnowflake(n) && !/^gamemaster$/i.test(n);
}

export function isPlaceholderDisplayName(name?: string | null) {
  const n = (name ?? "").trim();
  return !n || /^gamemaster$/i.test(n) || isDiscordSnowflake(n);
}

export function discordDisplayName(
  lookup: DiscordLookup | null | undefined,
  fallback?: string | null
) {
  if (lookup && isRealName(lookup.username) && lookup.status !== "missing") {
    return lookup.username.trim();
  }
  if (lookup && isRealName(lookup.nick)) return lookup.nick!.trim();
  if (lookup && isRealName(lookup.handle)) return lookup.handle.trim();
  if (!isPlaceholderDisplayName(fallback)) return fallback!.trim();
  if (lookup?.status === "loading") return "";
  if (lookup && isRealName(lookup.handle)) return lookup.handle.trim();
  return "";
}

const memory = new Map<string, DiscordLookup>();
const inflight = new Map<string, Promise<DiscordLookup>>();

function asLookup(
  id: string,
  data: Partial<DiscordLookup> | null
): DiscordLookup {
  const username = isRealName(data?.username)
    ? data!.username!.trim()
    : isRealName(data?.nick)
      ? data!.nick!.trim()
      : isRealName(data?.handle)
        ? data!.handle!.trim()
        : id;
  return {
    id,
    username,
    handle: data?.handle || "",
    avatarUrl: data?.avatarUrl || "",
    bannerUrl: data?.bannerUrl ?? null,
    decorationUrl: data?.decorationUrl ?? null,
    accent: data?.accent ?? null,
    inGuild: Boolean(data?.inGuild),
    nick: data?.nick ?? null,
    roles: Array.isArray(data?.roles) ? data.roles : [],
    grade: data?.grade ?? null,
    status:
      isRealName(username) || Boolean(data?.avatarUrl) ? "ready" : "missing",
  };
}

function loadDiscordUser(id: string) {
  const cached = memory.get(id);
  if (cached && cached.status !== "loading") return Promise.resolve(cached);
  const pending = inflight.get(id);
  if (pending) return pending;
  const request = fetch(`/api/discord/user/${id}`, { signal: AbortSignal.timeout(8000) })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const next = asLookup(id, data);
      memory.set(id, next);
      return next;
    })
    .catch(() => {
      const next = asLookup(id, null);
      memory.set(id, next);
      return next;
    })
    .finally(() => {
      inflight.delete(id);
    });
  inflight.set(id, request);
  return request;
}

export function useDiscordUser(discordId?: string | null) {
  const id = parseDiscordId(discordId ?? "");
  const valid = isDiscordSnowflake(id);
  const [user, setUser] = useState<DiscordLookup | null>(() =>
    valid ? memory.get(id) ?? null : null
  );

  useEffect(() => {
    if (!valid) {
      setUser(null);
      return;
    }
    const cached = memory.get(id);
    if (cached) {
      setUser(cached);
      if (cached.status !== "loading") return;
    }
    let cancelled = false;
    void loadDiscordUser(id).then((next) => {
      if (!cancelled) setUser(next);
    });
    return () => {
      cancelled = true;
    };
  }, [id, valid]);

  return user;
}
