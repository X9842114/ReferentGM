"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  canConfigureMissionReview,
  canSeeReadChronometer,
  getMissionReviewSettings,
  setMissionReviewSettings,
  type MissionReviewMode,
} from "@/lib/mission-settings";
import { canAccessStaffTools } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { BookOpen, Scale, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

export function MissionReviewSettingsPanel() {
  const { account, grade } = useAccount();
  const canEdit = canConfigureMissionReview(grade);
  const [mode, setMode] = useState<MissionReviewMode>("READ");
  const [quorum, setQuorum] = useState(2);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getMissionReviewSettings();
    setMode(s.reviewMode);
    setQuorum(s.voteQuorum);
    const refresh = () => {
      const next = getMissionReviewSettings();
      setMode(next.reviewMode);
      setQuorum(next.voteQuorum);
    };
    window.addEventListener("refgm:mission-settings-updated", refresh);
    return () =>
      window.removeEventListener("refgm:mission-settings-updated", refresh);
  }, []);

  function save() {
    if (!canEdit) return;
    setMissionReviewSettings({
      reviewMode: mode,
      voteQuorum: quorum,
      updatedBy: account.displayName,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <StaffPageShell
      title="Règles missions"
      description="Choisis le mode lecture obligatoire ou le vote par quorum (Lead / Co-Lead / Superviseur / Dev)"
    >
      {!canEdit ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
          Réservé au Développeur, Superviseur, Lead et Co-Lead.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("READ")}
              className={cn(
                "rounded-2xl border p-5 text-left transition-colors",
                mode === "READ"
                  ? "border-violet-400/40 bg-violet-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              )}
            >
              <BookOpen className="mb-3 h-5 w-5 text-violet-300" />
              <p className="text-sm font-medium text-white/90">Mode lecture</p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Chaque référent doit lire la mission jusqu’au bout et marquer
                « lu ». Chronomètre visible uniquement Lead+.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("VOTE")}
              className={cn(
                "rounded-2xl border p-5 text-left transition-colors",
                mode === "VOTE"
                  ? "border-violet-400/40 bg-violet-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              )}
            >
              <Scale className="mb-3 h-5 w-5 text-violet-300" />
              <p className="text-sm font-medium text-white/90">Mode vote</p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Les référents votent pour / contre. La mission est tranchée
                quand le quorum est atteint d’un côté.
              </p>
            </button>
          </div>

          <label className="block max-w-xs space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <span className="text-[11px] tracking-wide text-white/40 uppercase">
              Quorum de votes (mode vote)
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={quorum}
              onChange={(e) => setQuorum(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
            <p className="text-[11px] text-white/35">
              Ex. 3 = 3 votes « pour » ou 3 « contre » pour clôturer.
            </p>
          </label>

          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black"
          >
            <Settings2 className="h-4 w-4" />
            {saved ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      )}

      {canAccessStaffTools(grade) && !canEdit ? (
        <p className="text-xs text-white/35">
          Mode actuel : {getMissionReviewSettings().reviewMode} · quorum{" "}
          {getMissionReviewSettings().voteQuorum}
        </p>
      ) : null}
    </StaffPageShell>
  );
}

/** Compact status used in other panels */
export function useMissionReviewMode() {
  const [mode, setMode] = useState<MissionReviewMode>("READ");
  const [quorum, setQuorum] = useState(2);
  useEffect(() => {
    const apply = () => {
      const s = getMissionReviewSettings();
      setMode(s.reviewMode);
      setQuorum(s.voteQuorum);
    };
    apply();
    window.addEventListener("refgm:mission-settings-updated", apply);
    return () =>
      window.removeEventListener("refgm:mission-settings-updated", apply);
  }, []);
  return { mode, quorum, canSeeChrono: false as boolean };
}

export function MissionReviewModeBadge({ grade }: { grade: Parameters<typeof canSeeReadChronometer>[0] }) {
  const { mode, quorum } = useMissionReviewMode();
  return (
    <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50">
      {mode === "READ" ? "Lecture obligatoire" : `Vote · quorum ${quorum}`}
      {canSeeReadChronometer(grade) ? " · chrono Lead+" : ""}
    </span>
  );
}
