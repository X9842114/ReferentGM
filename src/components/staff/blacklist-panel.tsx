"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import { canAccessStaffTools, isGameMaster } from "@/lib/permissions";
import {
  addBlacklist,
  listBlacklist,
  setBlacklistActive,
  type BlacklistEntry,
} from "@/lib/staff-storage";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function BlacklistPanel() {
  const { account, grade } = useAccount();
  const canManage = canAccessStaffTools(grade);
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [gms, setGms] = useState<RefgmAccount[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  function refresh() {
    setEntries(listBlacklist());
  }

  useEffect(() => {
    refresh();
    void listAllAccounts().then((list) =>
      setGms(list.filter((a) => a.status === "APPROVED" && isGameMaster(a.grade)))
    );
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    return () => window.removeEventListener("refgm:staff-updated", onUpdate);
  }, []);

  function add() {
    const target = gms.find((g) => g.userId === targetUserId);
    if (!target || !reason.trim()) return;
    addBlacklist({
      targetUserId: target.userId,
      targetName: target.displayName,
      reason,
      createdBy: account.userId,
      createdByName: account.displayName,
    });
    setReason("");
    setTargetUserId("");
    refresh();
  }

  return (
    <StaffPageShell
      title="Blacklist"
      description="Sanctions GM, suivi des exclusions"
    >
      {canManage ? (
        <div className="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-[1fr_1.2fr_auto]">
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          >
            <option value="">Choisir un GM…</option>
            {gms.map((gm) => (
              <option key={gm.userId} value={gm.userId}>
                {gm.displayName}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-xl border border-rose-400/25 bg-rose-500/15 px-4 py-2 text-xs text-rose-100"
          >
            Blacklister
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-white/35">Aucune sanction enregistrée.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-white/90">
                  {entry.targetName}
                </p>
                <p className="mt-1 text-xs text-white/45">{entry.reason}</p>
                <p className="mt-1 text-[11px] text-white/30">
                  par {entry.createdByName} ·{" "}
                  {new Date(entry.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px]",
                    entry.active
                      ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
                      : "border-white/10 text-white/35"
                  )}
                >
                  {entry.active ? "Active" : "Levée"}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBlacklistActive(entry.id, !entry.active);
                      refresh();
                    }}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06]"
                  >
                    {entry.active ? "Lever" : "Réactiver"}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </StaffPageShell>
  );
}
