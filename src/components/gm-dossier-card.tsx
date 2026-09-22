"use client";

import { useAccount } from "@/components/account-context";
import { OrIcon } from "@/components/or-icon";
import {
  GM_CELL_ROLE_LABEL,
  getGmDossier,
  updateGmTrameStatus,
  type GmDossier,
} from "@/lib/gm-cells";
import { getGmCellStats } from "@/lib/gm-cell-activity";
import { isGameMaster } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  MapPin,
  ScrollText,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function GmDossierCard({
  userId,
  editable = false,
}: {
  userId: string;
  /** Le GM peut mettre à jour l’avancement de sa trame */
  editable?: boolean;
}) {
  const { account, grade } = useAccount();
  const [dossier, setDossier] = useState<GmDossier | null>(null);
  const [tab, setTab] = useState<"infos" | "trame">("infos");
  const [trameDraft, setTrameDraft] = useState("");
  const [stats, setStats] = useState<ReturnType<typeof getGmCellStats>>(null);

  function refresh() {
    const d = getGmDossier(userId);
    setDossier(d);
    setTrameDraft(d.cell?.trameStatus ?? "");
    if (d.cell) setStats(getGmCellStats(d.cell.id));
    else setStats(null);
  }

  useEffect(() => {
    refresh();
    window.addEventListener("refgm:staff-updated", refresh);
    window.addEventListener("refgm:missions-updated", refresh);
    return () => {
      window.removeEventListener("refgm:staff-updated", refresh);
      window.removeEventListener("refgm:missions-updated", refresh);
    };
  }, [userId]);

  if (!dossier) return null;
  if (!dossier.cell && dossier.businesses.length === 0) return null;

  const cell = dossier.cell;
  const role = dossier.role;
  const canEditTrame =
    editable &&
    isGameMaster(grade) &&
    account.userId === userId &&
    Boolean(cell);

  return (
    <section className="rg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <Users className="h-4 w-4 text-white/45" />
        <p className="text-sm font-medium text-white/85">Dossier GameMaster</p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06] px-3 pt-2">
        {(
          [
            ["infos", "Infos"],
            ["trame", "Informations Trame"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-xs transition",
              tab === id
                ? "border border-b-0 border-white/10 bg-[#0a0a0b] text-white/90"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-5">
        {tab === "infos" ? (
          <>
            {cell ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-medium text-white/90">
                    {cell.groupName}
                  </p>
                  {role ? (
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">
                      {GM_CELL_ROLE_LABEL[role]}
                    </span>
                  ) : null}
                </div>
                <p className="inline-flex items-start gap-2 text-sm text-white/50">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                  QG · {cell.qgPosition.trim() || "Non renseigné"}
                </p>
                {cell.notes.trim() ? (
                  <p className="text-xs text-white/40">{cell.notes}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {cell.members.map((m) => (
                    <span
                      key={m.userId}
                      className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-white/55"
                    >
                      {GM_CELL_ROLE_LABEL[m.cellRole]} · {m.displayName}
                      {m.uniqueId ? ` · ${m.uniqueId}` : ""}
                    </span>
                  ))}
                </div>
                {stats ? (
                  <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                    <Mini tip="Missions" v={stats.missionCount} />
                    <Mini tip="Validées" v={stats.approvedCount} />
                    <Mini
                      tip="Or rouge"
                      v={
                        <span className="inline-flex items-center gap-1">
                          <OrIcon color="rouge" className="h-3 w-3" />
                          {stats.orRouge}
                        </span>
                      }
                    />
                    <Mini
                      tip="Or bleu"
                      v={
                        <span className="inline-flex items-center gap-1">
                          <OrIcon color="bleu" className="h-3 w-3" />
                          {stats.orBleu}
                        </span>
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/40">Aucun groupe GM attribué.</p>
            )}

            <div className="border-t border-white/10 pt-3">
              <p className="mb-2 inline-flex items-center gap-2 text-xs tracking-wide text-white/40 uppercase">
                <Briefcase className="h-3.5 w-3.5" />
                Business
              </p>
              {dossier.businesses.length === 0 ? (
                <p className="text-sm text-white/35">Aucun business</p>
              ) : (
                <ul className="space-y-1.5">
                  {dossier.businesses.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
                    >
                      <p className="text-sm text-white/85">{b.name}</p>
                      {b.description ? (
                        <p className="mt-0.5 text-[11px] text-white/35">
                          {b.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ScrollText className="h-4 w-4 text-white/40" />
              Trame
            </div>
            {cell ? (
              <>
                <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <p className="text-[11px] tracking-wide text-white/35 uppercase">
                    Nom
                  </p>
                  <p className="mt-1 text-sm text-white/85">
                    {cell.trameLabel?.trim() || "Non définie"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <p className="text-[11px] tracking-wide text-white/35 uppercase">
                    Infos (référents)
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/65">
                    {cell.trameInfo?.trim() || "Pas encore renseigné"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <p className="text-[11px] tracking-wide text-white/35 uppercase">
                    Où en sont les GM
                  </p>
                  {canEditTrame ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={trameDraft}
                        onChange={(e) => setTrameDraft(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                        placeholder="Ex. Acte 2, préparation du braquage…"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!cell) return;
                          updateGmTrameStatus(cell.id, trameDraft, {
                            id: account.userId,
                            name: account.displayName,
                          });
                          refresh();
                        }}
                        className="rounded-xl border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs text-white/80"
                      >
                        Enregistrer l’avancement
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/65">
                      {cell.trameStatus?.trim() || "Pas encore mis à jour"}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/40">
                Pas de groupe GM, donc pas de trame.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Mini({ tip, v }: { tip: string; v: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
      <p className="text-[9px] tracking-wide text-white/30 uppercase">{tip}</p>
      <p className="text-xs text-white/80">{v}</p>
    </div>
  );
}
