import {
  discordAccentHex,
  discordAvatarFromProfile,
  discordBannerUrl,
  discordDecorationUrl,
} from "@/lib/discord-avatar";
import "server-only";

const API = "https://discord.com/api/v10";
const FETCH_MS = 4000;

async function fetchTimed(url: string, init: RequestInit = {}, ms = FETCH_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function discordLogChannelId() {
  return (
    process.env.DISCORD_CHANNEL_LOGS?.trim() ||
    process.env.DISCORD_CHANNEL_MISSIONS?.trim() ||
    process.env.DISCORD_CHANNEL_PROPOSITION_MISSION?.trim() ||
    ""
  );
}

export function discordPublicStatus() {
  return {
    bot: Boolean(process.env.DISCORD_BOT_TOKEN?.trim()),
    logs: Boolean(discordLogChannelId()),
  };
}

export async function postDiscordLog(embed: Record<string, unknown>) {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const channelId = discordLogChannelId();
  if (!token || !channelId) return null;

  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[refgm] discord log", res.status, text.slice(0, 200));
    return null;
  }
  return res.json() as Promise<{ id: string }>;
}

export type DiscordPublicUser = {
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
};

type DiscordUserJson = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
  banner?: string | null;
  accent_color?: number | null;
  avatar_decoration_data?: { asset?: string | null } | null;
};

function mapDiscordUser(
  user: DiscordUserJson,
  staff?: {
    inGuild: boolean;
    nick: string | null;
    roles: { id: string; name: string; color: string | null }[];
    grade: string | null;
  }
): DiscordPublicUser {
  const id = user.id;
  const handle = (user.username ?? "").trim();
  const nick = staff?.nick?.trim() || "";
  return {
    id,
    username: (user.global_name ?? "").trim() || handle || nick || id,
    handle,
    avatarUrl: discordAvatarFromProfile(id, user.avatar, 256),
    bannerUrl: discordBannerUrl(id, user.banner),
    decorationUrl: discordDecorationUrl(user.avatar_decoration_data?.asset),
    accent: discordAccentHex(user.accent_color),
    inGuild: staff?.inGuild ?? false,
    nick: nick || null,
    roles: staff?.roles ?? [],
    grade: staff?.grade ?? null,
  };
}

export async function fetchDiscordOauthUser(
  accessToken: string
): Promise<DiscordPublicUser | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const res = await fetchTimed(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn("[refgm] discord @me", res.status);
    return null;
  }
  const user = (await res.json()) as DiscordUserJson;
  const { fetchStaffGuildMember } = await import("@/lib/discord-grade-roles");
  const staff = await fetchStaffGuildMember(user.id);
  return mapDiscordUser(user, staff);
}

async function fetchViaBot(id: string): Promise<DiscordUserJson | null> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetchTimed(`${API}/users/${id}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[refgm] discord user", id, res.status);
      return null;
    }
    return (await res.json()) as DiscordUserJson;
  } catch (error) {
    console.warn("[refgm] discord user", id, error);
    return null;
  }
}

async function fetchViaPublicLookup(id: string): Promise<DiscordUserJson | null> {
  try {
    const res = await fetchTimed(`https://japi.rest/discord/v1/user/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: DiscordUserJson;
    } & DiscordUserJson;
    const user = body.data?.id ? body.data : body.id ? body : null;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

export async function fetchDiscordUser(
  userId: string
): Promise<DiscordPublicUser | null> {
  const id = userId.trim();
  if (!/^\d{17,20}$/.test(id)) return null;

  let staff: Awaited<
    ReturnType<
      typeof import("@/lib/discord-grade-roles").fetchStaffGuildMember
    >
  > | null = null;
  try {
    const { fetchStaffGuildMember } = await import("@/lib/discord-grade-roles");
    staff = await fetchStaffGuildMember(id);
  } catch {
    staff = null;
  }

  const fromApi =
    (await fetchViaBot(id)) ||
    staff?.user ||
    (await fetchViaPublicLookup(id));

  if (fromApi) {
    return mapDiscordUser(fromApi, staff ?? undefined);
  }

  return {
    id,
    username: staff?.nick || "",
    handle: "",
    avatarUrl: discordAvatarFromProfile(id),
    bannerUrl: null,
    decorationUrl: null,
    accent: null,
    inGuild: staff?.inGuild ?? false,
    nick: staff?.nick ?? null,
    roles: staff?.roles ?? [],
    grade: staff?.grade ?? null,
  };
}

