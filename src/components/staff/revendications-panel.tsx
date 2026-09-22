"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { canAccessStaffTools } from "@/lib/permissions";
import {
  deleteRevendication,
  listRevendications,
  saveRevendication,
  type Revendication,
  type RevendicationKind,
} from "@/lib/staff-storage";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function RevendicationsPanel() {
  const { grade } = useAccount();
  const canManage = canAccessStaffTools(grade);
  const [rows, setRows] = useState<Revendication[]>([]);
  const [tab, setTab] = useState<RevendicationKind>("DROGUE");
  const [label, setLabel] = useState("");
  const [holders, setHolders] = useState("");
  const [typeLabel, setTypeLabel] = useState("ORGANISATION");

  function refresh() {
    setRows(listRevendications());
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    return () => window.removeEventListener("refgm:staff-updated", onUpdate);
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => r.kind === tab),
    [rows, tab]
  );

  function create() {
    if (!label.trim()) return;
    saveRevendication({
      kind: tab,
      label,
      blGl: null,
      typeLabel,
      holders: holders.split(",").map((h) => h.trim()).filter(Boolean),
    });
    setLabel("");
    setHolders("");
    refresh();
  }

  return (
    <StaffPageShell
      title="Revendications"
      description="Qui contrôle drogues / business"
    >
      <div className="flex gap-2">
        {(["DROGUE", "BUSINESS"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs",
              tab === k
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 text-white/40"
            )}
          >
            {k === "DROGUE" ? "Drogues" : "Business"}
          </button>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-4">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none sm:col-span-1"
          />
          <input
            value={typeLabel}
            onChange={(e) => setTypeLabel(e.target.value)}
            placeholder="Type (ORGA / GANG)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          />
          <input
            value={holders}
            onChange={(e) => setHolders(e.target.value)}
            placeholder="Contrôleurs (virgules)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={create}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-xs text-emerald-100"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {filtered.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-white/90">{row.label}</p>
              <p className="mt-1 text-[11px] text-white/40">{row.typeLabel}</p>
              <p className="mt-2 text-xs text-white/55">
                {row.holders.length > 0
                  ? row.holders.join(" · ")
                  : "Aucun contrôleur"}
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  deleteRevendication(row.id);
                  refresh();
                }}
                className="self-start text-rose-300/80"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </StaffPageShell>
  );
}
