"use client";

import { GroupKindTabs } from "@/components/group-kind-tabs";
import { MetallicButton } from "@/components/ui/metallic-button";
import { useRpGroups } from "@/hooks/use-rp-groups";
import { GROUP_KIND_LABEL, type GroupKind } from "@/lib/rp-groups";
import { Dices } from "lucide-react";
import { useMemo, useState } from "react";

const KIND_COLORS: Record<GroupKind, [string, string]> = {
  PF: ["#38bdf8", "#0ea5e9"],
  GANG: ["#fb7185", "#e11d48"],
  ORGA: ["#fbbf24", "#d97706"],
};

type KindFilter = "ALL" | GroupKind;

export function GroupRoulette({
  selectedId,
  onPick,
}: {
  selectedId: string;
  onPick: (groupId: string) => void;
}) {
  const catalog = useRpGroups();
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const pool = useMemo(() => {
    const list =
      kind === "ALL" ? catalog : catalog.filter((g) => g.kind === kind);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [catalog, kind]);

  const n = Math.max(pool.length, 1);
  const gradient = useMemo(() => {
    if (!pool.length) return "#141416";
    const stops = pool.flatMap((g, i) => {
      const [a, b] = KIND_COLORS[g.kind];
      const color = i % 2 === 0 ? a : b;
      const from = (i / n) * 360;
      const to = ((i + 1) / n) * 360;
      return [`${color} ${from}deg ${to}deg`];
    });
    return `conic-gradient(from -90deg, ${stops.join(", ")})`;
  }, [pool, n]);

  function spin() {
    if (spinning || pool.length < 2) return;
    const index = Math.floor(Math.random() * pool.length);
    const center = ((index + 0.5) / n) * 360;
    const extra = 360 * (5 + Math.floor(Math.random() * 3));
    const next = extra + (360 - center);
    setSpinning(true);
    setWinnerId(null);
    setRotation((prev) => prev + next);
    window.setTimeout(() => {
      const picked = pool[index];
      setWinnerId(picked.id);
      onPick(picked.id);
      setSpinning(false);
    }, 4200);
  }

  const winner = pool.find((g) => g.id === winnerId) ?? null;
  const selected = catalog.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="rg-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Roulette groupes</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            Tire un groupe à suivre, puis note le give.
          </p>
        </div>
        <GroupKindTabs
          value={kind}
          onChange={(next) => {
            setKind(next);
            setWinnerId(null);
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-56 w-56 shrink-0 sm:mx-0">
          <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1">
            <div className="h-0 w-0 border-x-[8px] border-t-[14px] border-x-transparent border-t-white" />
          </div>
          <div
            className="h-full w-full rounded-full border-[6px] border-[#1c1c20] shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]"
            style={{
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4.2s cubic-bezier(0.12, 0.75, 0.08, 1)"
                : "none",
            }}
          >
            <div className="absolute inset-[28%] flex items-center justify-center rounded-full border border-white/10 bg-[#0a0a0b]">
              <Dices className="h-7 w-7 text-white/80" />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-wide text-white/35">
            {spinning ? "Ça tourne…" : winner ? "Tirage" : "Groupe actuel"}
          </p>
          <p className="text-xl font-semibold text-white">
            {spinning
              ? "…"
              : winner?.name || selected?.name || "·"}
          </p>
          {(winner || selected) && !spinning ? (
            <p className="text-xs text-white/45">
              {GROUP_KIND_LABEL[(winner ?? selected)!.kind]} ·{" "}
              {(winner ?? selected)!.id}
            </p>
          ) : null}
          <MetallicButton
            type="button"
            onClick={spin}
            disabled={spinning || pool.length < 2}
            label={spinning ? "Roulette…" : "Lancer la roulette"}
          />
          <p className="text-[11px] text-white/30">
            {pool.length} groupe{pool.length > 1 ? "s" : ""} dans le tirage
          </p>
        </div>
      </div>
    </div>
  );
}
