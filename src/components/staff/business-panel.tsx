"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import { isGameMaster } from "@/lib/permissions";
import { canAccessStaffTools } from "@/lib/permissions";
import {
  deleteBusiness,
  listBusinesses,
  logActivity,
  saveBusiness,
  type StaffBusiness,
} from "@/lib/staff-storage";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function BusinessPanel() {
  const { account, grade } = useAccount();
  const canManage = canAccessStaffTools(grade);
  const [rows, setRows] = useState<StaffBusiness[]>([]);
  const [gms, setGms] = useState<RefgmAccount[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function refresh() {
    setRows(listBusinesses());
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

  const gmMap = useMemo(
    () => Object.fromEntries(gms.map((g) => [g.userId, g])),
    [gms]
  );

  function create() {
    if (!name.trim()) return;
    const created = saveBusiness({
      name,
      description,
      assigneeIds: [],
    });
    logActivity({
      action: "business.created",
      details: created.name,
      actorId: account.userId,
      actorName: account.displayName,
    });
    setName("");
    setDescription("");
    refresh();
  }

  function toggleAssignee(business: StaffBusiness, gmId: string) {
    const has = business.assigneeIds.includes(gmId);
    saveBusiness({
      ...business,
      assigneeIds: has
        ? business.assigneeIds.filter((id) => id !== gmId)
        : [...business.assigneeIds, gmId],
    });
    refresh();
  }

  return (
    <StaffPageShell
      title="Business"
      description="Assignation des business aux GameMasters"
      actions={
        canManage ? (
          <div className="flex w-full max-w-md flex-col gap-2 sm:w-72">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du business"
              className="rg-field"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="rg-field"
            />
            <button
              type="button"
              onClick={create}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" /> Créer
            </button>
          </div>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-white/35">Aucun business pour l’instant.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white/90">{b.name}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {b.description || "·"}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteBusiness(b.id);
                      refresh();
                    }}
                    className="text-rose-300/80 hover:text-rose-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.assigneeIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-100"
                  >
                    {gmMap[id]?.displayName || id}
                  </span>
                ))}
                {b.assigneeIds.length === 0 ? (
                  <span className="text-[11px] text-white/30">Aucun GM</span>
                ) : null}
              </div>
              {canManage && gms.length > 0 ? (
                <select
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    toggleAssignee(b, id);
                    e.target.value = "";
                  }}
                >
                  <option value="">Assigner / retirer un GM…</option>
                  {gms.map((gm) => (
                    <option key={gm.userId} value={gm.userId}>
                      {b.assigneeIds.includes(gm.userId) ? "✓ " : ""}
                      {gm.displayName}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </StaffPageShell>
  );
}
