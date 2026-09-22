"use client";

import { cn } from "@/lib/utils";
import type { WheelTheme } from "@/lib/or-market";
import { useMemo, useState } from "react";

type Props = {
  themes: WheelTheme[];
  spinning: boolean;
  resultIndex: number | null;
  accent: "rouge" | "bleu";
  onSpin: () => void;
  disabled?: boolean;
};

export function OrMarketWheel({
  themes,
  spinning,
  resultIndex,
  accent,
  onSpin,
  disabled,
}: Props) {
  const n = themes.length || 1;
  const slice = 360 / n;

  const rotation = useMemo(() => {
    if (resultIndex == null) return 0;
    const center = resultIndex * slice + slice / 2;
    return 360 * 6 + (360 - center);
  }, [resultIndex, slice]);

  const gradient = useMemo(() => {
    if (!themes.length) return "conic-gradient(#333 0deg 360deg)";
    const parts = themes.map((t, i) => {
      const start = i * slice;
      const end = (i + 1) * slice;
      return `${t.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(from -90deg, ${parts.join(", ")})`;
  }, [themes, slice]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-[240px] sm:size-[280px]">
        <div
          className={cn(
            "absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1",
            "h-0 w-0 border-x-[10px] border-x-transparent border-b-[18px]",
            accent === "rouge" ? "border-b-rose-400" : "border-b-sky-400"
          )}
        />
        <div
          className={cn(
            "size-full rounded-full border-4 shadow-2xl transition-transform ease-out",
            accent === "rouge" ? "border-rose-500/40" : "border-sky-500/40",
            spinning ? "duration-[4200ms]" : "duration-300"
          )}
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {themes.map((t, i) => {
            const angle = -90 + i * slice + slice / 2;
            const rad = (angle * Math.PI) / 180;
            const r = 36;
            const x = 50 + r * Math.cos(rad);
            const y = 50 + r * Math.sin(rad);
            return (
              <span
                key={t.id}
                className="pointer-events-none absolute max-w-[70px] -translate-x-1/2 -translate-y-1/2 text-center text-[8px] font-bold leading-tight text-black/90 sm:text-[9px]"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {t.label}
              </span>
            );
          })}
          <div className="absolute inset-[38%] rounded-full border border-black/20 bg-[#0a0a0b] shadow-inner" />
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || spinning}
        onClick={onSpin}
        className={cn(
          "rounded-full px-8 py-2.5 text-sm font-semibold transition disabled:opacity-50",
          accent === "rouge"
            ? "bg-rose-500 text-white hover:bg-rose-400"
            : "bg-sky-500 text-black hover:bg-sky-400"
        )}
      >
        {spinning ? "La roue tourne…" : "Tirer la roue"}
      </button>
    </div>
  );
}

export function useWheelSpin() {
  const [spinning, setSpinning] = useState(false);
  const [resultIndex, setResultIndex] = useState<number | null>(null);

  async function runSpin(index: number, ms = 4200) {
    setSpinning(true);
    setResultIndex(null);
    await new Promise((r) => setTimeout(r, 50));
    setResultIndex(index);
    await new Promise((r) => setTimeout(r, ms));
    setSpinning(false);
  }

  return { spinning, resultIndex, runSpin, setResultIndex };
}
