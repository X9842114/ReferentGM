import { kvRead, kvWrite } from "@/lib/app-kv";
import { getGradeDef } from "@/lib/grade-registry";
import { type RefgmProfileRow } from "@/lib/supabase";

export type ManualProfileBadge =
  | "staff"
  | "moderateur"
  | "gestionnaire"
  | "responsable";

export const MANUAL_PROFILE_BADGES: {
  id: ManualProfileBadge;
  label: string;
}[] = [
  { id: "moderateur", label: "Modérateur" },
  { id: "staff", label: "Staff" },
  { id: "gestionnaire", label: "Gestionnaire" },
  { id: "responsable", label: "Responsable" },
];

export type ProfileVisual = {
  userId: string;
  /** ID unique affiché (Discord snowflake si lié, sinon userId) */
  uniqueId: string;
  displayName: string;
  bio: string;
  /** Bannière uploadée (data URL, PNG/JPG/WEBP/GIF) */
  bannerDataUrl: string;
  /** Toujours l’avatar Discord (ou vide si invité) */
  discordAvatarUrl: string;
  discordLinked: boolean;
  /** Permissions in-game */
  hasIgPerms: boolean;
  accent: string;
  updatedAt: string;
  decorationUrl?: string;
  /** Badges attribués à la main (Staff / Modérateur). */
  manualBadges: ManualProfileBadge[];
};

function normalizeManualBadges(value: unknown): ManualProfileBadge[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(MANUAL_PROFILE_BADGES.map((b) => b.id));
  const out: ManualProfileBadge[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item as ManualProfileBadge)) {
      const id = item as ManualProfileBadge;
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function statusBadgesFromGrade(gradeId?: string | null): ManualProfileBadge[] {
  if (!gradeId?.trim()) return [];
  const id = gradeId.toUpperCase();
  const label = getGradeDef(gradeId).label.toLowerCase();
  const out: ManualProfileBadge[] = [];
  if (id.includes("RESPONSABLE") || label.includes("responsable")) {
    out.push("responsable");
  }
  if (id.includes("GESTIONNAIRE") || label.includes("gestionnaire")) {
    out.push("gestionnaire");
  }
  return out;
}

export function mergeStatusBadges(
  manual: ManualProfileBadge[] | undefined,
  gradeId?: string | null
): ManualProfileBadge[] {
  const set = new Set([
    ...statusBadgesFromGrade(gradeId),
    ...(manual ?? []),
  ]);
  return MANUAL_PROFILE_BADGES.map((b) => b.id).filter((id) => set.has(id));
}

const DIRECTORY_KEY = "refgm.profiles.directory.v1";

export const ACCENT_PRESETS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#67e8f9",
  "#f97316",
  "#e2e8f0",
] as const;

/** ~1.5 Mo — localStorage + GIF animés */
export const BANNER_MAX_BYTES = 1_500_000;

export const BANNER_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";

export function resolveUniqueId(seed: {
  userId: string;
  discordLinked?: boolean;
  discordId?: string | null;
}) {
  const snowflake = (value?: string | null) => {
    const id = value?.trim() ?? "";
    return /^\d{17,20}$/.test(id) ? id : "";
  };
  return snowflake(seed.discordId) || snowflake(seed.userId) || seed.userId;
}

export function defaultProfile(seed: {
  userId: string;
  name?: string | null;
  image?: string | null;
  discordLinked?: boolean;
  discordId?: string | null;
  hasIgPerms?: boolean;
  bannerUrl?: string | null;
  decorationUrl?: string | null;
  accent?: string | null;
}): ProfileVisual {
  const discordLinked = Boolean(seed.discordLinked);
  return {
    userId: seed.userId,
    uniqueId: resolveUniqueId({
      userId: seed.userId,
      discordLinked,
      discordId: seed.discordId,
    }),
    displayName: seed.name?.trim() || "Référent GM",
    bio: "",
    bannerDataUrl: seed.bannerUrl?.trim() || "",
    discordAvatarUrl: seed.image?.trim() || "",
    discordLinked,
    hasIgPerms: Boolean(seed.hasIgPerms),
    accent: seed.accent?.trim() || ACCENT_PRESETS[0],
    updatedAt: new Date().toISOString(),
    decorationUrl: seed.decorationUrl?.trim() || "",
    manualBadges: [],
  };
}

function normalizeProfile(
  raw: Partial<ProfileVisual> & { userId: string },
  fallback?: Partial<ProfileVisual>
): ProfileVisual {
  const userId = raw.userId || fallback?.userId || "unknown";
  const discordLinked = Boolean(
    raw.discordLinked ?? fallback?.discordLinked ?? false
  );
  const uniqueId =
    (typeof raw.uniqueId === "string" && raw.uniqueId.trim()) ||
    fallback?.uniqueId ||
    userId;

  return {
    userId,
    uniqueId,
    displayName:
      (typeof raw.displayName === "string" && raw.displayName.trim()) ||
      fallback?.displayName ||
      "Référent GM",
    bio: typeof raw.bio === "string" ? raw.bio : fallback?.bio || "",
    bannerDataUrl:
      typeof raw.bannerDataUrl === "string"
        ? raw.bannerDataUrl
        : fallback?.bannerDataUrl || "",
    discordAvatarUrl:
      typeof raw.discordAvatarUrl === "string"
        ? raw.discordAvatarUrl
        : fallback?.discordAvatarUrl || "",
    discordLinked,
    hasIgPerms: Boolean(raw.hasIgPerms ?? fallback?.hasIgPerms ?? false),
    manualBadges: normalizeManualBadges(
      raw.manualBadges ?? fallback?.manualBadges
    ),
    accent:
      typeof raw.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.accent)
        ? raw.accent
        : fallback?.accent || ACCENT_PRESETS[0],
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : fallback?.updatedAt || new Date().toISOString(),
    decorationUrl:
      typeof raw.decorationUrl === "string"
        ? raw.decorationUrl
        : fallback?.decorationUrl || "",
  };
}

function profileToRow(profile: ProfileVisual): RefgmProfileRow {
  return {
    user_id: profile.userId,
    unique_id: profile.uniqueId,
    display_name: profile.displayName,
    bio: profile.bio,
    banner_data_url: profile.bannerDataUrl,
    discord_avatar_url: profile.discordAvatarUrl,
    discord_linked: profile.discordLinked,
    has_ig_perms: profile.hasIgPerms,
    accent: profile.accent,
    updated_at: profile.updatedAt,
    manual_badges: profile.manualBadges,
  };
}

function rowToProfile(row: RefgmProfileRow): ProfileVisual {
  return normalizeProfile({
    userId: row.user_id,
    uniqueId: row.unique_id,
    displayName: row.display_name,
    bio: row.bio,
    bannerDataUrl: row.banner_data_url,
    discordAvatarUrl: row.discord_avatar_url,
    discordLinked: row.discord_linked,
    hasIgPerms: row.has_ig_perms,
    accent: row.accent,
    updatedAt: row.updated_at,
    manualBadges: normalizeManualBadges(row.manual_badges),
  });
}

function readDirectory(): Record<string, ProfileVisual> {
  const parsed = kvRead<Record<string, Partial<ProfileVisual>>>(DIRECTORY_KEY, {});
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, ProfileVisual> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object") continue;
    out[id] = normalizeProfile({ ...value, userId: value.userId || id });
  }
  return out;
}

function writeDirectory(dir: Record<string, ProfileVisual>) {
  kvWrite(DIRECTORY_KEY, dir, "refgm:profile-updated");
}

function sortProfiles(list: ProfileVisual[]) {
  return list.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
      a.displayName.localeCompare(b.displayName, "fr")
  );
}

export function listProfiles(): ProfileVisual[] {
  return sortProfiles(Object.values(readDirectory()));
}

export function getProfile(userId: string): ProfileVisual | null {
  const entry = readDirectory()[userId];
  return entry ?? null;
}

/** Charge l’annuaire depuis Supabase (fallback localStorage). */
export async function listProfilesAsync(): Promise<ProfileVisual[]> {
  const local = readDirectory();
  try {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    if (!response.ok) return sortProfiles(Object.values(local));
    const body = (await response.json()) as { profiles?: RefgmProfileRow[] };
    if (!Array.isArray(body.profiles)) return sortProfiles(Object.values(local));
    const merged = { ...local };
    for (const row of body.profiles) {
      const profile = rowToProfile(row);
      const existing = merged[profile.userId];
      if (
        !existing ||
        new Date(profile.updatedAt).getTime() >=
          new Date(existing.updatedAt).getTime()
      ) {
        merged[profile.userId] = profile;
      }
    }
    writeDirectory(merged);
    return sortProfiles(Object.values(merged));
  } catch {
    return sortProfiles(Object.values(local));
  }
}

export async function getProfileAsync(
  userId: string
): Promise<ProfileVisual | null> {
  const local = getProfile(userId);
  try {
    const response = await fetch(
      `/api/profiles?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return local;
    const body = (await response.json()) as { profiles?: RefgmProfileRow[] };
    const row = body.profiles?.[0];
    if (!row) return local;
    const profile = rowToProfile(row);
    const dir = readDirectory();
    dir[profile.userId] = profile;
    writeDirectory(dir);
    return profile;
  } catch {
    return local;
  }
}

export function loadOwnProfile(seed: {
  userId: string;
  name?: string | null;
  image?: string | null;
  discordLinked?: boolean;
  discordId?: string | null;
  hasIgPerms?: boolean;
}): ProfileVisual {
  const base = defaultProfile(seed);
  const existing = getProfile(seed.userId);
  if (!existing) return base;

  return normalizeProfile(
    {
      ...existing,
      userId: seed.userId,
      discordAvatarUrl: seed.image?.trim() || existing.discordAvatarUrl,
      discordLinked: Boolean(seed.discordLinked),
      uniqueId: resolveUniqueId({
        userId: seed.userId,
        discordLinked: Boolean(seed.discordLinked),
        discordId: seed.discordId,
      }),
      displayName:
        existing.displayName.trim() ||
        seed.name?.trim() ||
        base.displayName,
      hasIgPerms: existing.hasIgPerms,
    },
    base
  );
}

export function setProfileManualBadges(
  userId: string,
  badges: ManualProfileBadge[],
  seed?: Partial<ProfileVisual>
): ProfileVisual {
  const existing = getProfile(userId);
  const base = defaultProfile({
    userId,
    name: seed?.displayName ?? existing?.displayName,
    image: seed?.discordAvatarUrl ?? existing?.discordAvatarUrl,
    discordLinked: seed?.discordLinked ?? existing?.discordLinked,
    discordId: seed?.uniqueId ?? existing?.uniqueId,
  });
  return saveOwnProfile({
    ...(existing ?? base),
    ...seed,
    userId,
    manualBadges: normalizeManualBadges(badges),
  });
}

export function saveOwnProfile(profile: ProfileVisual): ProfileVisual {
  const next = normalizeProfile({
    ...profile,
    displayName: profile.displayName.trim() || "Référent GM",
    bio: profile.bio.trim(),
    bannerDataUrl: profile.bannerDataUrl.trim(),
    discordAvatarUrl: profile.discordAvatarUrl.trim(),
    uniqueId: profile.uniqueId.trim() || profile.userId,
    updatedAt: new Date().toISOString(),
  });
  const dir = readDirectory();
  dir[next.userId] = next;
  writeDirectory(dir);
  void persistProfileSession(next);
  return next;
}

async function persistProfileSession(profile: ProfileVisual) {
  try {
    await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileToRow(profile)),
    });
  } catch {
    /* cache KV */
  }
}

export async function saveOwnProfileAsync(
  profile: ProfileVisual
): Promise<{ profile: ProfileVisual; supabaseError?: string }> {
  const next = saveOwnProfile(profile);
  try {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileToRow(next)),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      return { profile: next, supabaseError: body?.error || "Enregistrement distant impossible." };
    }
  } catch {
    return { profile: next, supabaseError: "Connexion perdue." };
  }
  return { profile: next };
}

export function readBannerFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const okType =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp" ||
      file.type === "image/gif" ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name);

    if (!okType) {
      reject(new Error("Formats acceptés : PNG, JPG, WEBP, GIF."));
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      reject(
        new Error(
          `Fichier trop lourd (max ${Math.round(BANNER_MAX_BYTES / 100_000) / 10} Mo).`
        )
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Impossible de lire le fichier."));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}
