"use client";

import { EmptyHint } from "@/components/empty-hint";
import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  exportActivityCsv,
  listActivity,
  logActivity,
  type ActivityEntry,
} from "@/lib/staff-storage";
import { Activity, Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";

function formatAction(action: string) {
  if (action === "note") return "Note";
  return action
    .split(".")
    .map((part) => part.replace(/[-_]/g, " "))
    .join(" · ");
}

export function ActivitePanel() {
  const { account } = useAccount();
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [note, setNote] = useState("");

  function refresh() {
    setRows(listActivity());
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    return () => window.removeEventListener("refgm:staff-updated", onUpdate);
  }, []);

  function addNote() {
    if (!note.trim()) return;
    logActivity({
      action: "note",
      details: note.trim(),
      actorId: account.userId,
      actorName: account.displayName,
    });
    setNote("");
    refresh();
  }

  function exportCsv() {
    const csv = exportActivityCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refgm-activite-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <StaffPageShell
      title="Activité"
      description="Journal du QG : notes staff, créations et exports CSV."
      className="max-w-5xl"
      actions={
        <button type="button" onClick={exportCsv} className="rg-btn">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      }
    >
      <div className="rg-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ajouter une note au journal…"
          className="rg-field flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") addNote();
          }}
        />
        <button
          type="button"
          onClick={addNote}
          className="rg-btn rg-btn-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyHint
          icon={<Activity className="h-7 w-7" />}
          title="Le journal est vide"
          hint="Les créations de groupes, validations et tes notes s’empilent ici. Ajoute une première note pour amorcer le fil."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm capitalize text-white/90">
                  {formatAction(row.action)}
                </p>
                <p className="text-[11px] tabular-nums text-white/30">
                  {new Date(row.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {row.details ? (
                <p className="mt-1 text-xs text-white/45">{row.details}</p>
              ) : null}
              <p className="mt-1 text-[11px] text-white/30">{row.actorName}</p>
            </div>
          ))}
        </div>
      )}
    </StaffPageShell>
  );
}
