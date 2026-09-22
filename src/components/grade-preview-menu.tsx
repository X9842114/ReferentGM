"use client";

import { useAccount } from "@/components/account-context";
import { listGradeDefs } from "@/lib/grade-registry";
import { getGradeLabel, type GradeId } from "@/lib/grades";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function GradePreviewMenu({
  variant = "nav",
}: {
  variant?: "nav" | "field";
}) {
  const { account, canPreviewGrades, previewGrade, setPreviewGrade } =
    useAccount();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const roles = listGradeDefs();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!canPreviewGrades || roles.length === 0) return null;

  const current = previewGrade
    ? getGradeLabel(previewGrade)
    : variant === "nav"
      ? "Réel"
      : `Grade réel (${getGradeLabel(account.grade)})`;

  return (
    <div
      ref={rootRef}
      className={cn("relative", variant === "nav" && "mb-2 hidden lg:block")}
    >
      {variant === "field" ? (
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-white/45 uppercase">
          Aperçu d’un grade
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left",
          variant === "nav"
            ? "h-8 rounded-lg border border-white/10 bg-black/45 px-2 text-[11px] text-white/80"
            : "rg-field"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate">{current}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className={cn(
            "rg-card absolute z-[80] max-h-64 w-full overflow-y-auto p-1",
            variant === "nav" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!previewGrade}
              onClick={() => {
                setPreviewGrade(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[12px]",
                !previewGrade
                  ? "bg-white/[0.08] text-white"
                  : "text-white/70 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              {variant === "nav"
                ? "Réel"
                : `Grade réel (${getGradeLabel(account.grade)})`}
              {!previewGrade ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          </li>
          {roles.map((role) => {
            const active = previewGrade === role.id;
            return (
              <li key={role.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setPreviewGrade(role.id as GradeId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px]",
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-white/70 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{role.label}</span>
                  {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
