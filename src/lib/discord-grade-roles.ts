import "server-only";

import { listGradeDefs } from "@/lib/grade-registry";
import type { GradeId } from "@/lib/grades";
import { getGradeRank } from "@/lib/grades";

/** Serveur Discord staff. `DISCORD_GUILD_ID` dans `.env`. */
export const DISCORD_STAFF_GUILD_ID =
  process.env.DISCORD_GUILD_ID?.trim() || "1369431707987738665";

/** Rôles Discord → grade RefGM (le plus haut gagne). */
export const DISCORD_GRADE_ROLES: { roleId: string; grade: GradeId }[] = [
  process.env.DISCORD_ROLE_RESPONSABLE?.trim() || "1369716605805789281",
].filter(Boolean).map((roleId) => ({ roleId, grade: "RESPONSABLE" as const }));

const API = "https://discord.com/api/v10";

export type DiscordGuildRole = {
  id: string;
  name: string;
  color: string | null;
};

export type DiscordStaffMember = {
  inGuild: boolean;
  nick: string | null;
  roleIds: string[];
  roles: DiscordGuildRole[];
  grade: GradeId | null;
  user: {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    banner?: string | null;
    accent_color?: number | null;
    avatar_decoration_data?: { asset?: string | null } | null;
  } | null;
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roleColor(raw?: number | null) {
  if (!raw) return null;
  return `#${raw.toString(16).padStart(6, "0")}`;
}

export function gradeFromDiscordRoleIds(roleIds: string[]): GradeId | null {
  const set = new Set(roleIds);
  let best: GradeId | null = null;
  for (const mapping of DISCORD_GRADE_ROLES) {
    if (!set.has(mapping.roleId)) continue;
    if (!best || getGradeRank(mapping.grade) < getGradeRank(best)) {
      best = mapping.grade;
    }
  }
  return best;
}

export function gradeFromDiscordRoles(
  roleIds: string[],
  roleNames: string[]
): GradeId | null {
  let best = gradeFromDiscordRoleIds(roleIds);
  const defs = listGradeDefs();
  for (const name of roleNames) {
    const key = fold(name);
    if (!key) continue;
    const match = defs.find(
      (grade) =>
        fold(grade.label) === key ||
        fold(grade.id.replace(/_/g, " ")) === key ||
        fold(grade.label) === `${key} gamemaster` ||
        fold(grade.label) === `referent ${key}`
    );
    if (!match) continue;
    if (!best || getGradeRank(match.id) < getGradeRank(best)) {
      best = match.id;
    }
  }
  return best;
}

type CachedRoles = { at: number; roles: DiscordGuildRole[] };
let rolesCache: CachedRoles | null = null;

async function fetchStaffGuildRoles(): Promise<DiscordGuildRole[]> {
  const now = Date.now();
  if (rolesCache && now - rolesCache.at < 10 * 60 * 1000) {
    return rolesCache.roles;
  }
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return rolesCache?.roles ?? [];
  const res = await fetch(
    `${API}/guilds/${DISCORD_STAFF_GUILD_ID}/roles`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.warn("[refgm] discord guild roles", res.status);
    return rolesCache?.roles ?? [];
  }
  const raw = (await res.json()) as { id?: string; name?: string; color?: number }[];
  const roles = (Array.isArray(raw) ? raw : [])
    .filter((role) => role.id && role.name && role.name !== "@everyone")
    .map((role) => ({
      id: role.id!,
      name: role.name!,
      color: roleColor(role.color),
    }));
  rolesCache = { at: now, roles };
  return roles;
}

function packMember(
  roleIds: string[],
  catalog: DiscordGuildRole[],
  nick?: string | null,
  user?: DiscordStaffMember["user"]
): DiscordStaffMember {
  const set = new Set(roleIds);
  const roles = catalog.filter((role) => set.has(role.id));
  return {
    inGuild: true,
    nick: nick?.trim() || null,
    roleIds,
    roles,
    grade: gradeFromDiscordRoles(
      roleIds,
      roles.map((role) => role.name)
    ),
    user: user ?? null,
  };
}

const ABSENT: DiscordStaffMember = {
  inGuild: false,
  nick: null,
  roleIds: [],
  roles: [],
  grade: null,
  user: null,
};

export async function fetchStaffGuildMember(
  userId: string
): Promise<DiscordStaffMember> {
  const id = userId.trim();
  if (!/^\d{17,20}$/.test(id)) return ABSENT;
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return ABSENT;
  try {
    const [memberRes, catalog] = await Promise.all([
      fetch(`${API}/guilds/${DISCORD_STAFF_GUILD_ID}/members/${id}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }),
      fetchStaffGuildRoles(),
    ]);
    if (memberRes.status === 404) return ABSENT;
    if (!memberRes.ok) {
      console.warn("[refgm] discord guild member", id, memberRes.status);
      return ABSENT;
    }
    const member = (await memberRes.json()) as {
      nick?: string | null;
      roles?: string[];
      user?: DiscordStaffMember["user"];
    };
    return packMember(member.roles ?? [], catalog, member.nick, member.user);
  } catch (error) {
    console.warn("[refgm] discord guild member", id, error);
    return ABSENT;
  }
}

export async function resolveDiscordStaffGrade(
  accessToken: string,
  userId?: string | null
): Promise<GradeId | null> {
  const catalog = await fetchStaffGuildRoles();
  const oauthRes = await fetch(
    `${API}/users/@me/guilds/${DISCORD_STAFF_GUILD_ID}/member`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (oauthRes.ok) {
    const member = (await oauthRes.json()) as {
      nick?: string | null;
      roles?: string[];
      user?: DiscordStaffMember["user"];
    };
    return packMember(member.roles ?? [], catalog, member.nick, member.user).grade;
  }
  if (userId) {
    return (await fetchStaffGuildMember(userId)).grade;
  }
  return null;
}
