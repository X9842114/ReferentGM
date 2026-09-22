"use client";

import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import {
  DiscordLinkBadge,
  ProfileManualBadges,
} from "@/components/profile-badges";
import { useDiscordUser, isDiscordSnowflake } from "@/hooks/use-discord-user";
import { pickDiscordAvatar } from "@/lib/discord-avatar";
import {
  BANNER_ACCEPT,
  mergeStatusBadges,
  readBannerFile,
  type ManualProfileBadge,
  type ProfileVisual,
} from "@/lib/profile-storage";
import { cn } from "@/lib/utils";
import { Check, Copy, ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

function hexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : raw.slice(0, 6);
  if (full.length < 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number) {
  const rgb = hexRgb(hex);
  if (!rgb) return `rgba(167, 139, 250, ${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function gradeInk(hex: string) {
  const parsed = hexRgb(hex);
  if (!parsed) return { color: "#0a0a0b", background: "#c4b5fd" };
  const luma =
    (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
  return {
    color: luma > 0.62 ? "#0a0a0b" : "#ffffff",
    background: hex,
  };
}

type ProfileCardProps = {
  profile: ProfileVisual;
  roleLabel?: string | null;
  roleColor?: string | null;
  gradeId?: string | null;
  badges?: ManualProfileBadge[];
  className?: string;
  featured?: boolean;
  href?: string;
  variant?: "card" | "banner";
  welcome?: string;
  actions?: ReactNode;
  editable?: boolean;
  onBannerChange?: (dataUrl: string) => void;
};

export function ProfileCard({
  profile,
  roleLabel,
  roleColor,
  badges,
  className,
  featured = false,
  href,
  gradeId,
  variant = "card",
  welcome,
  actions,
  editable = false,
  onBannerChange,
}: ProfileCardProps) {
  const discordId = isDiscordSnowflake(profile.uniqueId)
    ? profile.uniqueId
    : isDiscordSnowflake(profile.userId)
      ? profile.userId
      : null;
  const lookup = useDiscordUser(discordId);
  const avatarSrc = pickDiscordAvatar(
    lookup?.avatarUrl,
    profile.discordAvatarUrl,
    discordId ? `/api/discord/avatar/${discordId}` : null
  );
  const displayName =
    lookup?.username && !isDiscordSnowflake(lookup.username)
      ? lookup.username
      : profile.displayName;
  const role = roleLabel?.trim() || null;
  const accent = lookup?.accent || profile.accent || roleColor || "#a78bfa";
  const banner = profile.bannerDataUrl || lookup?.bannerUrl || null;
  const decoration = lookup?.decorationUrl || profile.decorationUrl || null;
  const shownBadges = mergeStatusBadges(
    badges ?? profile.manualBadges ?? [],
    gradeId
  );
  const linked = Boolean(discordId || profile.discordLinked);
  const shownId = discordId || profile.uniqueId;
  const [copied, setCopied] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bio = profile.bio?.trim();
  const gradeTone = gradeInk(roleColor || accent);
  const tall = featured || variant === "banner";

  async function copyId() {
    try {
      await navigator.clipboard.writeText(shownId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  async function applyBanner(file: File | undefined) {
    if (!file || !onBannerChange) return;
    setBannerError(null);
    try {
      const dataUrl = await readBannerFile(file);
      onBannerChange(dataUrl);
      setBannerOpen(false);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Import impossible.");
    }
  }

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#09090b]",
        bannerOpen && "overflow-visible",
        className
      )}
    >
      <div className={cn("relative", tall ? "min-h-[220px] sm:min-h-[248px]" : "min-h-[188px]")}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_35%]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(70% 90% at 70% 10%, ${rgba(accent, 0.55)}, transparent 50%), linear-gradient(160deg, #141418, ${rgba(accent, 0.28)})`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />

        {editable ? (
          <div className="absolute inset-x-3 top-3 z-20 flex flex-col items-end">
            <button
              type="button"
              onClick={() => setBannerOpen((open) => !open)}
              className="rg-btn h-9 gap-1.5 px-3 text-[11px]"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Bannière
            </button>
            {bannerOpen ? (
              <div className="rg-card mt-2 w-full max-w-[18rem] space-y-3 p-3">
                <label
                  className="flex cursor-pointer flex-col items-center rounded-[1.1rem] border border-dashed border-white/15 bg-black/30 px-4 py-5 text-center hover:border-violet-300/35 hover:bg-white/[0.04]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void applyBanner(e.dataTransfer.files[0]);
                  }}
                >
                  <ImagePlus className="h-5 w-5 text-violet-200/80" />
                  <span className="mt-2 text-sm text-white/80">Importer une image</span>
                  <span className="mt-1 text-[11px] text-white/40">
                    PNG, JPG, WEBP ou GIF · 1,5 Mo max
                  </span>
                  <input
                    type="file"
                    accept={BANNER_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      void applyBanner(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {banner ? (
                  <button
                    type="button"
                    className="rg-btn w-full"
                    onClick={() => {
                      onBannerChange?.("");
                      setBannerOpen(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Retirer la bannière
                  </button>
                ) : null}
                {bannerError ? (
                  <p className="text-[11px] text-rose-300">{bannerError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="relative z-10 flex min-h-[inherit] flex-col justify-end gap-4 p-5 sm:p-6">
          <div className="flex items-end gap-4">
            <DiscordDecoratedAvatar
              name={displayName}
              url={avatarSrc}
              decorationUrl={decoration}
              userId={discordId}
              size={tall ? 84 : 72}
              status={linked ? "online" : "offline"}
              statusTitle={linked ? "Discord lié" : "Discord non lié"}
              ringClassName="ring-[4px] ring-black/70"
            />
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="truncate text-[1.7rem] font-semibold tracking-tight text-white drop-shadow">
                {displayName}
              </h2>
              {role ? (
                <p
                  className="mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={gradeTone}
                >
                  {role}
                </p>
              ) : null}
              {welcome ? (
                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/70">
                  {welcome}
                </p>
              ) : bio ? (
                <p className="mt-2 line-clamp-2 max-w-lg text-sm text-white/65">
                  {bio}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="hidden shrink-0 pb-1 sm:block">{actions}</div>
            ) : href ? (
              <Link href={href} className="rg-btn mb-1 hidden shrink-0 sm:inline-flex">
                Profil
              </Link>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DiscordLinkBadge linked={linked} />
            <ProfileManualBadges badges={shownBadges} />
            {shownId ? (
              <button
                type="button"
                onClick={() => void copyId()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 font-mono text-[11px] text-white/70 backdrop-blur-md hover:text-white"
                title="Copier l’ID Discord"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-300" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copié" : shownId}
              </button>
            ) : null}
          </div>
          {actions || href ? (
            <div className="sm:hidden">
              {actions ?? (
                <Link href={href!} className="rg-btn">
                  Profil
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
