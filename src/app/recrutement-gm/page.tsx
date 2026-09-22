import { auth, signIn } from "@/auth";
import { CandidateApplicationPanel } from "@/components/recruitment/candidate-application-panel";
import { DiscordSubmitButton } from "@/components/auth/discord-submit-button";
import { Gamepad2, ShieldCheck } from "lucide-react";

export default async function RecruitmentPage() {
  const session = await auth();
  const discordReady = Boolean(session?.user?.id && session.user.discordLinked);

  return (
    <main className="lab-bg relative flex min-h-dvh flex-col overflow-hidden bg-[#0A0A0B] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[12%] h-[28rem] w-[28rem] rounded-full bg-teal-500/10 blur-[130px]" />
        <div className="absolute right-[8%] bottom-0 h-80 w-80 rounded-full bg-violet-500/8 blur-[120px]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col">
        <div className={`flex flex-1 ${discordReady ? "items-start" : "items-center justify-center py-10"}`}>{!discordReady ? (
          <section className="relative mx-auto w-full max-w-xl animate-in overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.075] via-white/[0.028] to-transparent p-8 text-center shadow-[0_35px_100px_-45px_rgba(56,189,248,.35)] duration-700 fade-in zoom-in-95 sm:p-11">
            <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#5865F2]/15 blur-3xl" />
            <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#5865F2]/25 bg-[#5865F2]/10 shadow-[0_0_35px_-12px_rgba(88,101,242,.75)]"><span className="absolute inset-0 animate-ping rounded-2xl border border-[#5865F2]/15 [animation-duration:2.8s]"/><Gamepad2 className="relative h-7 w-7 text-indigo-200" /></div>
            <h1 className="bg-gradient-to-r from-white/95 to-white/50 bg-clip-text text-3xl font-medium tracking-tight text-transparent">Devenir GameMaster</h1>
            <p className="mt-3 text-sm leading-6 text-white/55">Connecte ton compte Discord pour envoyer ta candidature et suivre son avancement jusqu’à la décision finale.</p>
            <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/recrutement-gm" }); }} className="relative mx-auto mt-8 max-w-sm">
              <DiscordSubmitButton />
            </form>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-white/35"><ShieldCheck className="h-4 w-4" /> Un compte Discord est obligatoire pour éviter les candidatures anonymes.</p>
          </section>
        ) : <CandidateApplicationPanel discordName={session?.user?.name || "Candidat Discord"} discordAvatarUrl={session?.user?.image} discordId={session?.user?.id || ""} />}</div>
      </div>
    </main>
  );
}
