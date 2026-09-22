"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";

type Idea = {
  title: string;
  summary: string;
  duration: string;
  tags: string[];
};

type Props = {
  onPick?: (idea: Idea) => void;
  /** Bouton sobre inline (toolbar éditeur) */
  compact?: boolean;
  className?: string;
};

export function MissionIdeasButton({ onPick, compact, className }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mission-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as {
        ideas?: Idea[];
        source?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Impossible de générer");
        return;
      }
      setIdeas(data.ideas ?? []);
      setSource(data.source ?? null);
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Aide IA, idées de mission"
        className={cn(
          compact
            ? "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] text-white/55 transition hover:bg-white/[0.08] hover:text-white/80"
            : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 hover:text-white/85",
          className
        )}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Idées IA
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative z-10 flex max-h-[min(88dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101012] shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white/85">
                    Idées de mission
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    Décris un objectif. Suggestions sobres pour débloquer
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto px-4 py-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="ex. braquage bijouterie, poursuite bateau…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
                />
                <button
                  type="button"
                  disabled={busy || !prompt.trim()}
                  onClick={() => void generate()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2 text-sm text-white/85 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 opacity-70" />
                  )}
                  Générer
                </button>
                {source ? (
                  <p className="text-[10px] text-white/30">
                    {source === "groq" ? "API connectée" : "Suggestions locales"}
                  </p>
                ) : null}
                {error ? <p className="text-sm text-rose-300">{error}</p> : null}

                <div className="space-y-2 pb-1">
                  {ideas.map((idea, i) => (
                    <button
                      key={`${idea.title}-${i}`}
                      type="button"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/15 hover:bg-white/[0.04]"
                      onClick={() => {
                        onPick?.(idea);
                        setOpen(false);
                      }}
                    >
                      <p className="text-sm text-white/90">{idea.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">
                        {idea.summary}
                      </p>
                      <p className="mt-2 text-[10px] text-white/30">
                        {idea.duration}
                        {(idea.tags ?? []).length
                          ? ` · ${idea.tags.join(", ")}`
                          : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** @deprecated use MissionIdeasButton */
export function MissionIdeasFab(props: Props) {
  return <MissionIdeasButton {...props} />;
}
