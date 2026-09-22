"use client";

import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { OrIcon } from "@/components/or-icon";
import {
  lookupOrgaGangReward,
  lookupPfReward,
  MISSION_DURATIONS,
  MISSION_SCENE_TYPES,
  ORGA_GANG_REWARD_GRID,
  PF_REWARD_GRID,
  PF_REWARD_SCALE_NOTE,
  REWARD_SCALE_NOTE,
  type MissionDurationId,
  type MissionSceneTypeId,
} from "@/lib/mission-reward-scale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

export function BaremesPanel() {
  const [metal, setMetal] = useState<"rouge" | "bleu">("rouge");
  const [duration, setDuration] = useState<MissionDurationId>("2h");
  const [scene, setScene] = useState<MissionSceneTypeId>("PED");

  const suggested = useMemo(
    () =>
      metal === "bleu"
        ? lookupPfReward(duration, scene)
        : lookupOrgaGangReward(duration, scene),
    [metal, duration, scene]
  );

  const grid = metal === "bleu" ? PF_REWARD_GRID : ORGA_GANG_REWARD_GRID;
  const note = metal === "bleu" ? PF_REWARD_SCALE_NOTE : REWARD_SCALE_NOTE;

  return (
    <StaffPageShell
      title="Barèmes"
      description="Grille Or Rouge (Orga / Gang) et Or Bleu (PF)"
      actions={
        <Link href="/dashboard/tableaux" className="rg-btn">
          Tableaux officiels
        </Link>
      }
    >
      <div className="flex flex-wrap gap-2">
        {(["rouge", "bleu"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetal(m)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
              metal === m
                ? "border-white/25 bg-white text-black"
                : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
            )}
          >
            <OrIcon color={m} className="h-4 w-4" />
            Or {m === "rouge" ? "Rouge" : "Bleu"}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-3 text-[11px] tracking-wide text-white/40 uppercase">
          Calculateur
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-white/45">
            Durée
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as MissionDurationId)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            >
              {MISSION_DURATIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/45">
            Type de scène
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value as MissionSceneTypeId)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            >
              {MISSION_SCENE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[11px] text-white/40">Récompense suggérée</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-medium tabular-nums text-white">
              <OrIcon color={metal} className="h-5 w-5" />
              {suggested}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/40">{note}</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <p className="text-sm text-white/80">
            Grille Or {metal === "rouge" ? "Rouge" : "Bleu"}
          </p>
          <p className="text-[11px] text-white/35">
            Clique une case pour la sélectionner
          </p>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#0c0c0e] px-3 py-2 text-[11px] font-medium tracking-wide text-white/40 uppercase">
                  Durée
                </th>
                {MISSION_SCENE_TYPES.map((s) => (
                  <th
                    key={s.id}
                    className="px-2 py-2 text-center text-[11px] font-medium tracking-wide text-white/40 uppercase"
                  >
                    {s.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MISSION_DURATIONS.map((d) => (
                <tr key={d.id} className="border-t border-white/[0.05]">
                  <td className="sticky left-0 bg-[#0c0c0e] px-3 py-2 text-xs text-white/65">
                    {d.label}
                  </td>
                  {MISSION_SCENE_TYPES.map((s) => {
                    const active = duration === d.id && scene === s.id;
                    return (
                      <td key={s.id} className="p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDuration(d.id);
                            setScene(s.id);
                          }}
                          className={cn(
                            "w-full rounded-md border px-2 py-2 text-center tabular-nums transition-colors",
                            active
                              ? "border-white/30 bg-white text-black"
                              : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/15 hover:bg-white/[0.05] hover:text-white/90"
                          )}
                        >
                          {grid[d.id][s.id]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </StaffPageShell>
  );
}
