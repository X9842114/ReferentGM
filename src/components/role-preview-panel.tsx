"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { getGradeLabel, type GradeId } from "@/lib/grades";
import { Eye, RotateCcw, ShieldAlert } from "lucide-react";

export function RolePreviewPanel() {
  const {
    actualGrade,
    canPreviewGrades,
    previewGrade,
    setPreviewGrade,
    gradeDefs,
  } = useAccount();

  if (!canPreviewGrades) {
    return (
      <StaffPageShell
        title="Aperçu"
        description="Outil réservé au compte Discord CVE."
      >
        <div className="rg-empty">
          <ShieldAlert className="mb-3 h-6 w-6 text-amber-200" />
          <p className="text-sm font-medium text-white/85">Aperçu réservé</p>
          <p className="mt-1 text-sm text-white/45">
            Cet outil est réservé au compte Discord CVE.
          </p>
        </div>
      </StaffPageShell>
    );
  }

  const activeGrade = previewGrade ?? actualGrade;

  return (
    <StaffPageShell
      title="Aperçu"
      description="Teste l'interface et les permissions de chaque grade sans modifier ton grade réel ni la base de données."
    >
      <div className="rg-card flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex items-center gap-2 text-sm text-white/55">
          <Eye className="h-4 w-4 text-violet-200" />
          Rôle affiché :
        </span>
        <strong className="text-sm text-violet-100">
          {getGradeLabel(activeGrade)}
        </strong>
        <button
          type="button"
          onClick={() => setPreviewGrade(null)}
          disabled={!previewGrade}
          className="rg-btn ml-auto text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Grade réel : {getGradeLabel(actualGrade)}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gradeDefs.map((role) => {
          const active = activeGrade === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setPreviewGrade(role.id as GradeId)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-white/30 bg-white/[0.10] shadow-lg"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <span
                className="mb-3 block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              <p className="text-sm font-medium text-white/90">{role.label}</p>
              <p className="mt-1 text-[11px] text-white/40">
                {role.kind === "DEV"
                  ? "Développeur"
                  : role.kind === "GAMEMASTER"
                    ? "GameMaster"
                    : "Référent"}
              </p>
            </button>
          );
        })}
      </div>
    </StaffPageShell>
  );
}
