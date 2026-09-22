"use client";

import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import { cn } from "@/lib/utils";
import {
  discordDisplayName,
  isDiscordSnowflake,
  isPlaceholderDisplayName,
  useDiscordUser,
} from "@/hooks/use-discord-user";
import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PersonTile({
  name,
  role,
  avatarUrl,
  decorationUrl,
  userId,
  meta,
  href,
  mine,
  verified,
  action,
  className,
}: {
  name: string;
  role?: string | null;
  avatarUrl?: string | null;
  decorationUrl?: string | null;
  userId?: string | null;
  meta?: string | null;
  href?: string;
  mine?: boolean;
  verified?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  const lookup = useDiscordUser(isDiscordSnowflake(userId) ? userId : null);
  const shown = discordDisplayName(lookup, name) || "Profil Discord…";
  const loading = lookup?.status === "loading" && isPlaceholderDisplayName(name);
  const body = (
    <article
      className={cn(
        "rg-card rg-lift flex items-center gap-3 px-3 py-2.5",
        mine && "ring-1 ring-violet-400/45",
        href && "transition-colors hover:border-white/16 hover:bg-white/[0.05]"
      )}
    >
      <DiscordDecoratedAvatar
        name={shown}
        url={avatarUrl || lookup?.avatarUrl}
        decorationUrl={decorationUrl || lookup?.decorationUrl}
        userId={userId}
        size={44}
        status={
          verified || lookup?.inGuild
            ? "online"
            : lookup?.status === "ready"
              ? "offline"
              : undefined
        }
        ringClassName="ring-2 ring-black/50"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
          <span className={cn("truncate", loading && "text-white/40")}>
            {loading ? "Profil Discord…" : shown}
          </span>
          {verified || Boolean(lookup?.inGuild && (lookup.grade || lookup.roles.length)) ? (
            <Check className="h-3 w-3 shrink-0 text-emerald-400" />
          ) : null}
          {mine ? (
            <span className="shrink-0 text-[9px] font-medium text-violet-300">
              toi
            </span>
          ) : null}
        </p>
        {role ? (
          <p className="truncate text-[11px] text-white/45">{role}</p>
        ) : null}
        {lookup?.handle && shown.toLowerCase() !== lookup.handle.toLowerCase() ? (
          <p className="truncate text-[10px] text-white/30">@{lookup.handle}</p>
        ) : null}
        {meta ? (
          <p className="mt-0.5 truncate text-[10px] tabular-nums text-white/35">
            {meta}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </article>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block min-w-[220px] max-w-[280px] flex-1", className)}>
        {body}
      </Link>
    );
  }

  return (
    <div className={cn("min-w-[220px] max-w-[280px] flex-1", className)}>
      {body}
    </div>
  );
}
