"use client";

import type { ButtonHTMLAttributes } from "react";
import {
  GROUP_KIND_CHIP,
  GROUP_KIND_CHIP_IDLE,
  GROUP_KIND_FILTERS,
  GROUP_KIND_LABEL,
  GROUP_KIND_TAB,
  GROUP_KIND_TAB_IDLE,
  GROUP_KIND_TEXT,
  type GroupKind,
  type GroupKindFilter,
} from "@/lib/rp-groups";
import { cn } from "@/lib/utils";

export function GroupKindTabs({
  value,
  onChange,
  counts,
  className,
}: {
  value: GroupKindFilter;
  onChange: (next: GroupKindFilter) => void;
  counts?: Partial<Record<GroupKindFilter, number>>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {GROUP_KIND_FILTERS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === k ? GROUP_KIND_TAB[k] : GROUP_KIND_TAB_IDLE[k]
          )}
        >
          {k === "ALL" ? "Tous" : GROUP_KIND_LABEL[k]}
          {counts && counts[k] != null ? (
            <span className="ml-1.5 opacity-70">{counts[k]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function GroupKindChip({
  kind,
  selected,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind: GroupKind;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        selected ? GROUP_KIND_CHIP[kind] : GROUP_KIND_CHIP_IDLE[kind],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GroupKindMark({ kind }: { kind: GroupKind }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold tracking-wide uppercase",
        GROUP_KIND_TEXT[kind]
      )}
    >
      {GROUP_KIND_LABEL[kind]}
    </span>
  );
}
