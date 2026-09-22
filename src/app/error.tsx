"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="lab-bg flex min-h-dvh items-center justify-center p-6 text-white"><section className="w-full max-w-lg rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-8 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-amber-300"/><h1 className="mt-5 text-2xl font-medium">Cette page a rencontré un problème</h1><p className="mt-3 text-sm leading-6 text-white/45">Tes données locales sont conservées. Réessaie d’afficher la page.</p><button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black"><RotateCcw className="h-4 w-4"/>Réessayer</button></section></main>;
}
