"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FilePenLine, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";

type Outcome = "send" | "draft";

type MissionSubmitOverlayProps = {
  outcome: Outcome | null;
  onComplete: (outcome: Outcome) => void;
};

export function MissionSubmitOverlay({
  outcome,
  onComplete,
}: MissionSubmitOverlayProps) {
  const [phase, setPhase] = useState<"idle" | "loading" | "success">("idle");

  useEffect(() => {
    if (!outcome) {
      setPhase("idle");
      return;
    }

    setPhase("loading");
    const successTimer = window.setTimeout(() => setPhase("success"), 1100);
    const doneTimer = window.setTimeout(() => onComplete(outcome), 2600);

    return () => {
      window.clearTimeout(successTimer);
      window.clearTimeout(doneTimer);
    };
  }, [outcome, onComplete]);

  const isSend = outcome === "send";

  return (
    <AnimatePresence>
      {outcome && phase !== "idle" ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0a0a0b]/75 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className={cn(
                "absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[100px]",
                isSend ? "bg-violet-500/25" : "bg-amber-400/20"
              )}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1.2 }}
              transition={{ duration: 1.1 }}
            />
          </div>

          <motion.div
            className="relative z-10 flex w-[min(22rem,90vw)] flex-col items-center rounded-2xl border border-white/10 bg-black/60 px-8 py-10 text-center shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="wait">
              {phase === "loading" ? (
                <motion.div
                  key="loading"
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <div
                    className={cn(
                      "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border",
                      isSend
                        ? "border-violet-400/30 bg-violet-500/15 text-violet-200"
                        : "border-amber-400/30 bg-amber-500/15 text-amber-100"
                    )}
                  >
                    {isSend ? (
                      <motion.div
                        animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                      >
                        <Send className="h-7 w-7" />
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={{ rotate: [0, -8, 8, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <FilePenLine className="h-7 w-7" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-base font-medium text-white/90">
                    {isSend ? "Envoi au Référent…" : "Enregistrement…"}
                  </p>
                  <p className="mt-2 text-sm text-white/40">
                    {isSend
                      ? "Transmission pour validation"
                      : "Sauvegarde de la mission"}
                  </p>
                  <Loader2 className="mt-5 h-5 w-5 animate-spin text-white/40" />
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className={cn(
                      "mb-5 flex h-16 w-16 items-center justify-center rounded-full",
                      isSend
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-200"
                    )}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: [0.5, 1.15, 1] }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CheckCircle2 className="h-8 w-8" />
                  </motion.div>
                  <p className="text-base font-medium text-white/95">
                    {isSend ? "Envoyée !" : "Brouillon enregistré"}
                  </p>
                  <p className="mt-2 text-sm text-white/40">
                    {isSend
                      ? "Les Référents GameMaster vont la relire"
                      : "Retrouve-la dans Mes Missions"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
