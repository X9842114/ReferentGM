/** Construit / normalise une URL d’avatar Discord (CDN actuel). */
export function discordAvatarFromProfile(
  userId: string,
  avatarHash?: string | null,
  size = 256
) {
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
  }
  let index = 0;
  try {
    index = Number((BigInt(userId) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function discordBannerUrl(
  userId: string,
  bannerHash?: string | null,
  size = 1024
) {
  const hash = bannerHash?.trim();
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/banners/${userId}/${hash}.${ext}?size=${size}`;
}

export function discordDecorationUrl(asset?: string | null) {
  const id = asset?.trim();
  if (!id) return null;
  return `https://cdn.discordapp.com/avatar-decoration-presets/${id}.png?passthrough=true`;
}

export function discordAccentHex(color?: number | null) {
  if (color == null || Number.isNaN(color)) return null;
  return `#${Math.max(0, color).toString(16).padStart(6, "0")}`;
}

export function discordNameplateUrl(asset?: string | null) {
  const id = asset?.trim();
  if (!id) return null;
  return `https://cdn.discordapp.com/assets/collectibles/${id}static.png`;
}
export function isDiscordDefaultAvatar(url?: string | null) {
  return Boolean(url?.includes("/embed/avatars/"));
}

/** Prefers a hashed Discord avatar over proxy, embed, and empty URLs. */
export function pickDiscordAvatar(
  ...urls: Array<string | null | undefined>
): string {
  const normalized = urls
    .map((url) => normalizeDiscordAvatarUrl(url, 256))
    .filter(Boolean);
  const hashed = normalized.find((url) =>
    /\/avatars\/\d{17,20}\/(a_)?[a-f0-9]{16,}\./i.test(url)
  );
  if (hashed) return hashed;
  const direct = normalized.find(
    (url) =>
      !url.includes("/api/discord/avatar") && !isDiscordDefaultAvatar(url)
  );
  if (direct) return direct;
  const embed = normalized.find((url) => isDiscordDefaultAvatar(url));
  if (embed) return embed;
  return normalized[0] || "";
}

export function discordAvatarPngFallback(url: string) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\.webp$/i, ".png");
    return parsed.toString();
  } catch {
    return url.replace(/\.webp(\?|$)/i, ".png$1");
  }
}

export function normalizeDiscordAvatarUrl(
  url?: string | null,
  size = 128
): string {
  const raw = url?.trim() ?? "";
  if (!raw || raw.startsWith("data:")) return raw;
  try {
    const parsed = new URL(raw);
    if (
      parsed.hostname === "media.discordapp.net" ||
      parsed.hostname === "cdn.discord.com"
    ) {
      parsed.hostname = "cdn.discordapp.com";
    }
    const animatedPng = parsed.pathname.match(
      /\/avatars\/(\d+)\/(a_[a-f0-9]+)\.(png|webp|jpg|jpeg)$/i
    );
    if (animatedPng) {
      parsed.pathname = `/avatars/${animatedPng[1]}/${animatedPng[2]}.gif`;
    }
    if (parsed.hostname.endsWith("discordapp.com")) {
      parsed.searchParams.set("size", String(size));
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}
