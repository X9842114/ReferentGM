"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LogOut, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { DiscordAvatar } from "@/components/actor-trace";

type PendingAccountScreenProps = {
  userName?: string | null;
  userImage?: string | null;
  signOutAction: () => Promise<void>;
  checking?: boolean;
};

export function PendingAccountScreen({
  userName,
  userImage,
  signOutAction,
  checking = false,
}: PendingAccountScreenProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const steps: {
    label: string;
    done: boolean;
    active?: boolean;
  }[] = [
    { label: "Discord connecté", done: true },
    { label: "Validation par un référent", done: false, active: true },
    { label: "Accès QG référents", done: false },
  ];

  return (
    <div className="lab-bg relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0b] p-6 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-[-10%] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]"
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.05, 0.92] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[-8%] bottom-[-5%] h-72 w-72 rounded-full bg-orange-400/10 blur-[100px]"
          animate={{ opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <motion.p
            className="text-sm tracking-[0.35em] text-amber-200/50 uppercase"
            animate={{ opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 3.2, repeat: Infinity }}
          >
            RefGM
          </motion.p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_80px_-20px_rgba(245,158,11,0.35)]">
          <div className="relative border-b border-white/[0.06] px-8 pt-10 pb-8 text-center">
            <div className="relative mx-auto mb-6 h-24 w-24">
              <motion.div
                className="absolute inset-0 rounded-full border border-amber-300/25"
                animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-[-4px] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0%, transparent 55%, rgba(251,191,36,0.15) 70%, #fbbf24 92%, transparent 100%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-[3px] overflow-hidden rounded-full border border-white/10 bg-[#0a0a0b]">
                <DiscordAvatar
                  name={userName || "?"}
                  url={userImage}
                  size={112}
                  className="h-full w-full rounded-full border-0 ring-0"
                />
              </div>
            </div>

            <h1 className="text-2xl font-medium tracking-tight text-white/95">
              En attente de validation
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/45">
              {userName ? (
                <>
                  Salut <span className="text-white/70">{userName}</span>.{" "}
                </>
              ) : null}
              Ton Discord est lié. Un référent doit confirmer que tu fais
              partie du staff référent GameMaster.
            </p>
          </div>

          <div className="space-y-5 px-8 py-7">
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-3">
                  <div
                    className={
                      step.done
                        ? "flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                        : step.active
                          ? "relative flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/35 bg-amber-500/10 text-[11px] text-amber-100"
                          : "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-white/30"
                    }
                  >
                    {step.done ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : step.active ? (
                      <>
                        <motion.span
                          className="absolute inset-0 rounded-full bg-amber-400/20"
                          animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                        {index + 1}
                      </>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        step.done
                          ? "text-sm text-white/70"
                          : step.active
                            ? "text-sm text-amber-100/90"
                            : "text-sm text-white/30"
                      }
                    >
                      {step.label}
                    </p>
                    {step.active ? (
                      <p className="text-[11px] text-white/35">
                        En cours
                        <span className="inline-block w-6 text-left">
                          {".".repeat((tick % 3) + 1)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/30 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    checking
                      ? "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      : "bg-white/25"
                  }`}
                />
                {checking
                  ? "Vérification du statut…"
                  : "Actualisation automatique"}
              </div>
              <span className="font-mono text-[10px] text-white/25">
                {String(tick % 60).padStart(2, "0")}s
              </span>
            </div>

            <form action={signOutAction} className="pt-1">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/80"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

type AccountApprovedCelebrationProps = {
  userName?: string | null;
  userImage?: string | null;
  gradeLabel?: string | null;
  onDone: () => void;
};

export function AccountApprovedCelebration({
  userName,
  userImage,
  gradeLabel,
  onDone,
}: AccountApprovedCelebrationProps) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="lab-bg relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0b] p-6 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[130px]"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.85, 0.45], scale: [0.4, 1.15, 1] }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const dist = 110 + (i % 3) * 28;
          return (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full bg-emerald-300/80"
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                scale: [0.4, 1, 0.2],
              }}
              transition={{ duration: 1.35, delay: 0.15 + i * 0.04, ease: "easeOut" }}
            />
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        <div className="relative mx-auto mb-8 h-28 w-28">
          <motion.div
            className="absolute inset-0 rounded-full border border-emerald-300/30"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.25, 1], opacity: [0, 0.7, 0] }}
            transition={{ duration: 1.2, delay: 0.1 }}
          />
          <div className="absolute inset-0 overflow-hidden rounded-full border border-emerald-400/25 bg-[#0a0a0b]">
            <DiscordAvatar
              name={userName || "?"}
              url={userImage}
              size={112}
              className="h-full w-full rounded-full border-0 ring-0"
            />
          </div>
          <motion.div
            className="absolute -right-1 -bottom-1 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.55)]"
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.35 }}
          >
            <Check className="h-5 w-5" strokeWidth={2.75} />
          </motion.div>
        </div>

        <motion.p
          className="text-sm tracking-[0.28em] text-emerald-200/55 uppercase"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          RefGM
        </motion.p>
        <motion.h1
          className="mt-3 text-3xl font-medium tracking-tight text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Compte validé
        </motion.h1>
        <motion.p
          className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {userName ? (
            <>
              Bienvenue <span className="text-white/75">{userName}</span>.{" "}
            </>
          ) : null}
          Ton accès est ouvert
          {gradeLabel ? (
            <>
              {" "}
              en tant que{" "}
              <span className="text-emerald-200/90">{gradeLabel}</span>
            </>
          ) : null}
          .
        </motion.p>

        <motion.div
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.7 }}
        >
          Ouverture du dashboard…
        </motion.div>
      </motion.div>
    </div>
  );
}

export function ReferentOnlyScreen({
  gradeLabel,
  signOutAction,
}: {
  gradeLabel?: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="lab-bg relative flex min-h-dvh items-center justify-center bg-[#0a0a0b] p-6 text-white">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#1a1a1e] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10">
          <ShieldCheck className="h-5 w-5 text-violet-300" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">
            Espace référents GameMaster
          </h1>
          <p className="text-sm text-[#8a8a93]">
            RefGM n’est pas l’outil GameMaster. Seuls les référents (et le
            staff lead) peuvent entrer.
            {gradeLabel ? (
              <>
                {" "}
                Ton grade actuel :{" "}
                <span className="text-white/80">{gradeLabel}</span>.
              </>
            ) : null}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.08]"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}

export function RejectedAccountScreen({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="lab-bg relative flex min-h-dvh items-center justify-center bg-[#0a0a0b] p-6 text-white">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-rose-500/20 bg-white/[0.02] p-8 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10">
          <ShieldX className="h-5 w-5 text-rose-300" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-medium text-white/90">Compte refusé</h1>
          <p className="text-sm text-white/45">
            Ton accès à l’espace référents GameMaster a été refusé. Contacte un
            lead si tu penses que c’est une erreur.
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.08]"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </motion.div>
    </div>
  );
}

type ValidationSuccessOverlayProps = {
  displayName: string;
  gradeLabel: string;
  avatarUrl?: string | null;
  onClose: () => void;
};

export function ValidationSuccessOverlay({
  displayName,
  gradeLabel,
  avatarUrl,
  onClose,
}: ValidationSuccessOverlayProps) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 2400);
    return () => window.clearTimeout(id);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-400/25 bg-[#0d1210] p-8 text-center shadow-[0_0_80px_-10px_rgba(16,185,129,0.45)]"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 bg-emerald-500/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.2] }}
            transition={{ duration: 1.1 }}
          />
          <div className="relative mx-auto mb-5 h-16 w-16">
            <div className="h-16 w-16 overflow-hidden rounded-2xl">
              <DiscordAvatar
                name={displayName}
                url={avatarUrl}
                size={64}
                className="h-16 w-16 rounded-2xl border-0 ring-0"
              />
            </div>
            <motion.div
              className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <Check className="h-4 w-4" strokeWidth={2.75} />
            </motion.div>
          </div>
          <p className="relative text-sm tracking-[0.2em] text-emerald-200/50 uppercase">
            Validé
          </p>
          <h2 className="relative mt-2 text-xl font-medium text-white">
            Compte confirmé
          </h2>
          <p className="relative mt-2 text-sm text-white/50">
            <span className="text-white/80">{displayName}</span> · {gradeLabel}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
