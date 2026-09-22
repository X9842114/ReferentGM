import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EmptyHint({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rg-empty gap-2", className)}>
      {icon ? (
        <div className="mb-1 text-violet-300/50">{icon}</div>
      ) : null}
      <p className="text-sm font-medium text-white/75">{title}</p>
      {hint ? (
        <p className="max-w-md text-xs leading-relaxed text-white/40">{hint}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
