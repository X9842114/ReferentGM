"use client";

import { normalizeDiscordAvatarUrl } from "@/lib/discord-avatar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export { AmbientBackground as SiteGlow } from "@/components/ambient-background";

export function AuthSplash({
  title = "RefGM",
  subtitle = "Ouverture du QG…",
  userName,
  userImage,
  className,
  fullscreen = true,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  userName?: string | null;
  userImage?: string | null;
  className?: string;
  fullscreen?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-background text-foreground",
        fullscreen && !compact && "fixed inset-0 z-[100] min-h-dvh",
        !fullscreen && !compact && "min-h-dvh w-full",
        compact && "min-h-64 w-full rounded-2xl border border-white/[0.08]",
        className
      )}
      aria-busy="true"
      aria-label={subtitle}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/16 blur-[90px]" />
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center px-6 py-10 text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={normalizeDiscordAvatarUrl(userImage, 96)}
            alt=""
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-full border border-white/15 object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-bold text-white/90">
            R
          </span>
        )}
        <p className="mt-5 text-base font-medium tracking-tight text-white">
          {title}
        </p>
        <p className="mt-1.5 text-sm text-white/45">{subtitle}</p>
        {userName ? (
          <p className="mt-1 text-xs text-white/30">{userName}</p>
        ) : null}

        <div className="mt-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white/80"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.14,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
