"use client";

import { AlertTriangle, Check, CloudUpload, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type SyncState = { status: "saving" | "saved" | "conflict" | "error"; message?: string } | null;

export function SharedSyncStatus() {
  const [state, setState] = useState<SyncState>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (event: Event) => {
      const detail = (event as CustomEvent<NonNullable<SyncState>>).detail;
      setState(detail);
      if (timer) clearTimeout(timer);
      if (detail.status === "saved") timer = setTimeout(() => setState(null), 1800);
    };
    window.addEventListener("refgm:sync-status", update);
    return () => { window.removeEventListener("refgm:sync-status", update); if (timer) clearTimeout(timer); };
  }, []);
  return <AnimatePresence>{state ? <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className={`fixed right-5 bottom-24 z-[80] flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-xl ${state.status === "error" || state.status === "conflict" ? "border-amber-400/25 bg-[#241d12]/95" : "border-white/10 bg-[#111116]/95"}`}>
    {state.status === "saving" ? <Loader2 className="h-4 w-4 animate-spin text-violet-300"/> : state.status === "saved" ? <Check className="h-4 w-4 text-emerald-300"/> : state.status === "error" || state.status === "conflict" ? <AlertTriangle className="h-4 w-4 text-amber-300"/> : <CloudUpload className="h-4 w-4"/>}
    <span>{state.message || (state.status === "saving" ? "Enregistrement…" : "Modifications synchronisées")}</span>
    {(state.status === "error" || state.status === "conflict") ? <button aria-label="Fermer" onClick={() => setState(null)}><X className="h-3.5 w-3.5 text-white/45"/></button> : null}
  </motion.div> : null}</AnimatePresence>;
}
