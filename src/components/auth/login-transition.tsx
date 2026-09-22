"use client";

import { normalizeDiscordAvatarUrl } from "@/lib/discord-avatar";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LoginTransitionProps = {
  userName?: string | null;
  userImage?: string | null;
  play: boolean;
  children: React.ReactNode;
};

export function LoginTransition({
  userName,
  userImage,
  play,
  children,
}: LoginTransitionProps) {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(play);
  const displayName = userName?.trim().split(/\s+/)[0] || "référent";

  useEffect(() => {
    if (!play) return;
    const hideTimer = window.setTimeout(() => setShowOverlay(false), 1100);
    const cleanUrl = window.setTimeout(() => {
      router.replace("/dashboard", { scroll: false });
    }, 1400);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanUrl);
    };
  }, [play, router]);

  return (
    <div className="relative min-h-screen">
      {children}

      <AnimatePresence>
        {showOverlay ? (
          <motion.div
            key="login-welcome"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/88 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              className="flex flex-col items-center px-6 text-center"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={normalizeDiscordAvatarUrl(userImage, 96)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-full border border-white/15 object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-bold text-white">
                  R
                </span>
              )}
              <p className="mt-5 text-lg font-medium tracking-tight text-white">
                Bienvenue, {displayName}
              </p>
              <p className="mt-1 text-sm text-white/40">Ouverture du QG</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
