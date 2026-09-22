"use client";

import { LoginSessionRedirect } from "@/components/auth/login-session-redirect";
import { NeuralNoise } from "@/components/ui/neural-noise";
import { motion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";

export function LoginView({
  discordConfigured,
  authError,
  children,
}: {
  discordConfigured: boolean;
  authError?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6">
      <LoginSessionRedirect />
      <NeuralNoise color={[1, 1, 1]} opacity={0.9} />

      <motion.div
        className="rg-card relative z-10 w-full max-w-[22rem] px-7 py-8 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-black">
          <Image
            src="/brand/fa-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
        </span>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-white/40 uppercase">
          RefGM
        </p>
        <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight text-white">
          Connexion
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          Espace des référents GameMaster.
        </p>

        {authError ? (
          <p className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            Connexion Discord impossible ({authError}).
          </p>
        ) : null}

        <div className="mt-7 w-full">{children}</div>

        <p className="mt-4 text-[11px] leading-relaxed text-white/32">
          {discordConfigured
            ? "Un référent valide ton accès la première fois."
            : "OAuth pas encore configuré : ouverture en mode invité."}
        </p>
      </motion.div>
    </div>
  );
}
