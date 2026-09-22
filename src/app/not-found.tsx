import Link from "next/link";

export default function NotFound() {
  return <main className="lab-bg flex min-h-dvh items-center justify-center p-6 text-white"><section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center"><p className="text-xs uppercase tracking-[.2em] text-violet-200/50">Erreur 404</p><h1 className="mt-3 text-3xl font-medium">Page introuvable</h1><p className="mt-3 text-sm text-white/40">Cette page n’existe pas ou ton rôle n’y a pas accès.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-medium text-[#071014]">Retour au tableau de bord</Link></section></main>;
}
