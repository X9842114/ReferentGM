"use client";

import {
  discordAvatarPngFallback,
  normalizeDiscordAvatarUrl,
  pickDiscordAvatar,
} from "@/lib/discord-avatar";
import { isDiscordSnowflake, useDiscordUser } from "@/hooks/use-discord-user";
import { cn } from "@/lib/utils";
import { formatReadDuration, type MissionActorTrace } from "@/lib/mission-storage";
import { useEffect, useState } from "react";

export function DiscordAvatar({
  name,
  url,
  size = 28,
  className,
  title,
  userId,
  decorationUrl,
  plain = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  title?: string;
  userId?: string | null;
  decorationUrl?: string | null;
  plain?: boolean;
}) {
  if (!plain && (userId || decorationUrl)) {
    return (
      <DiscordDecoratedAvatar
        name={name}
        url={url}
        size={size}
        className={className}
        title={title}
        userId={userId}
        decorationUrl={decorationUrl}
      />
    );
  }
  return (
    <BareDiscordAvatar
      name={name}
      url={url}
      size={size}
      className={className}
      title={title}
      fallbackId={userId}
    />
  );
}

function BareDiscordAvatar({
  name,
  url,
  size = 28,
  className,
  title,
  fallbackId,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  title?: string;
  fallbackId?: string | null;
}) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const preferred = pickDiscordAvatar(
    url,
    isDiscordSnowflake(fallbackId)
      ? `/api/discord/avatar/${fallbackId}`
      : null
  );
  const sized = normalizeDiscordAvatarUrl(
    preferred,
    size >= 80 ? 256 : size >= 48 ? 128 : 64
  );
  const [src, setSrc] = useState(sized);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setSrc(sized);
    setBroken(false);
  }, [sized]);
  const showImage = Boolean(src) && !broken;

  return (
    <span
      title={title || name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-white/10 text-[10px] font-medium text-white/80 ring-2 ring-[#0a0a0b]",
        !className?.includes("rounded") && "rounded-full",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
            const png = discordAvatarPngFallback(src);
            if (png !== src) {
              setSrc(png);
              return;
            }
            const fromUrl = src.match(/\/avatars\/(\d{17,20})\//)?.[1];
            const id = isDiscordSnowflake(fallbackId)
              ? fallbackId
              : fromUrl;
            const proxy =
              id && !src.includes("/api/discord/avatar/")
                ? `/api/discord/avatar/${id}`
                : "";
            if (proxy) {
              setSrc(proxy);
              return;
            }
            setBroken(true);
          }}
        />
      ) : (
        initial
      )}
    </span>
  );
}

export function DiscordDecoratedAvatar({
  name,
  url,
  decorationUrl,
  size = 80,
  className,
  title,
  status,
  statusTitle,
  ringClassName,
  userId,
}: {
  name: string;
  url?: string | null;
  decorationUrl?: string | null;
  size?: number;
  className?: string;
  title?: string;
  status?: "online" | "offline";
  statusTitle?: string;
  ringClassName?: string;
  userId?: string | null;
}) {
  const lookup = useDiscordUser(isDiscordSnowflake(userId) ? userId : null);
  const src = pickDiscordAvatar(
    lookup?.avatarUrl,
    url,
    isDiscordSnowflake(userId) ? `/api/discord/avatar/${userId}` : null
  );
  const deco = decorationUrl || lookup?.decorationUrl || null;
  const wrap = deco ? Math.round(size * (size < 48 ? 1.28 : 1.35)) : size;
  const inset = (wrap - size) / 2;
  const dot = Math.max(10, Math.round(size * 0.2));
  const ring = size < 48 ? "ring-2" : "ring-4";
  return (
    <span
      title={title || name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className
      )}
      style={{ width: wrap, height: wrap }}
    >
      <span
        className={cn(
          "absolute overflow-hidden rounded-full bg-black/50",
          ringClassName ?? `${ring} ring-[#0c0c0e]`
        )}
        style={{
          width: size,
          height: size,
          top: inset,
          left: inset,
        }}
      >
        <BareDiscordAvatar
          name={name}
          url={src}
          size={size}
          fallbackId={userId}
          className="h-full w-full rounded-full border-0 ring-0"
        />
      </span>
      {deco ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={deco}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none object-contain"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {status ? (
        <span
          className={cn(
            "absolute z-[2] rounded-full ring-[3px] ring-[#0c0c0e]",
            status === "online" ? "bg-emerald-400" : "bg-zinc-500"
          )}
          title={statusTitle}
          style={{
            width: dot,
            height: dot,
            right: inset - 1,
            bottom: inset - 1,
          }}
        />
      ) : null}
    </span>
  );
}

export function ActorTraceStack({
  actors,
  showChrono = false,
  emptyLabel = "Aucune trace",
}: {
  actors: MissionActorTrace[];
  showChrono?: boolean;
  emptyLabel?: string;
}) {
  if (!actors.length) {
    return <p className="text-xs text-white/35">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {actors.map((a) => (
        <li key={`${a.userId}-${a.at}`} className="flex items-center gap-2.5">
          <DiscordAvatar name={a.displayName} url={a.avatarUrl} size={32} userId={a.userId} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/85">{a.displayName}</p>
            <p className="text-[11px] text-white/35">
              {new Date(a.at).toLocaleString("fr-FR")}
              {showChrono && a.durationMs != null
                ? ` · lu en ${formatReadDuration(a.durationMs)}`
                : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
