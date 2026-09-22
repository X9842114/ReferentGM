"use client";

import { MetallicButton } from "@/components/ui/metallic-button";
import { useAccount } from "@/components/account-context";
import {
  deleteGroupRewards,
  getGroupReward,
  updateGroupReward,
  type GroupRewardEntry,
} from "@/lib/group-reward-log";
import { logActivity } from "@/lib/staff-storage";
import { Pencil, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

function loadRows(ids: string[]) {
  return ids
    .map((id) => getGroupReward(id))
    .filter((row): row is GroupRewardEntry => Boolean(row));
}

export function SuiviManageActions({
  rewardIds,
  compact = false,
}: {
  rewardIds: string[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!rewardIds.length) return null;
  return (
    <>
      <div className="flex shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Modifier le suivi"
          className={
            compact
              ? "inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white"
              : "rg-btn h-8 px-3 text-[11px]"
          }
        >
          <Pencil className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {compact ? null : "Modifier"}
        </button>
      </div>
      {open ? (
        <SuiviEditorDialog
          rewardIds={rewardIds}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SuiviEditorDialog({
  rewardIds,
  onClose,
}: {
  rewardIds: string[];
  onClose: () => void;
}) {
  const { account } = useAccount();
  const rows = useMemo(() => loadRows(rewardIds), [rewardIds]);
  const head = rows[0];
  const [title, setTitle] = useState(head?.missionTitle ?? "");
  const [missionDate, setMissionDate] = useState(head?.missionDate ?? "");
  const [startTime, setStartTime] = useState(head?.startTime ?? "");
  const [gmName, setGmName] = useState(head?.gmName ?? "");
  const [note, setNote] = useState(head?.rewardNote ?? "");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, String(row.amount)]))
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!head) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4">
        <div className="rg-card max-w-sm p-5 text-sm text-white/70">
          Ce suivi n’existe plus.
          <button type="button" className="mt-3 block text-white" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  function save() {
    if (!title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    for (const row of rows) {
      const amount = Math.max(0, Math.round(Number(amounts[row.id] ?? row.amount) || 0));
      updateGroupReward(row.id, {
        missionTitle: title,
        missionDate,
        startTime,
        gmName,
        rewardNote: note,
        amount,
      });
    }
    logActivity({
      action: "Suivi modifié",
      details: title.trim(),
      actorId: account?.userId ?? null,
      actorName: account?.displayName || "Référent",
    });
    onClose();
  }

  function remove() {
    deleteGroupRewards(rows.map((row) => row.id));
    logActivity({
      action: "Suivi supprimé",
      details: head.missionTitle || head.groupName,
      actorId: account?.userId ?? null,
      actorName: account?.displayName || "Référent",
    });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suivi-edit-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p id="suivi-edit-title" className="text-lg font-semibold">
              Modifier le suivi
            </p>
            <p className="text-xs text-white/40">{head.groupName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 pb-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rg-field py-2.5"
            placeholder="Titre de la mission"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={missionDate}
              onChange={(e) => setMissionDate(e.target.value)}
              className="rg-field py-2.5"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rg-field py-2.5"
            />
          </div>
          <input
            value={gmName}
            onChange={(e) => setGmName(e.target.value)}
            className="rg-field py-2.5"
            placeholder="GM"
          />
          {rows.map((row) => (
            <label key={row.id} className="block text-[11px] text-white/40">
              Or {row.color}
              <input
                inputMode="numeric"
                value={amounts[row.id] ?? ""}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
                className="rg-field mt-1 py-2.5"
              />
            </label>
          ))}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rg-field min-h-20 resize-none py-2.5"
            placeholder="Note"
          />
          {error ? <p className="text-xs text-rose-200">{error}</p> : null}
          {confirmDelete ? (
            <p className="text-xs text-rose-200">
              Supprimer définitivement ce suivi ?
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-black/25 px-5 py-4">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="rg-btn"
                  onClick={() => setConfirmDelete(false)}
                >
                  Annuler
                </button>
                <button type="button" className="rg-btn rg-btn-danger" onClick={remove}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Confirmer
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rg-btn rg-btn-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
                <button type="button" className="rg-btn" onClick={onClose}>
                  Annuler
                </button>
                <MetallicButton label="Enregistrer" onClick={save} />
              </>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
}
