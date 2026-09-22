"use client";

import { OrIcon } from "@/components/or-icon";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { useRpGroups } from "@/hooks/use-rp-groups";
import {
  listGroupRewards,
  statsByGroupId,
  syncGroupRewardIdentity,
  type GroupCardStats,
} from "@/lib/group-reward-log";
import { remapMissionGroupId } from "@/lib/mission-storage";
import {
  addRpGroup,
  GROUP_KIND_LABEL,
  removeRpGroup,
  updateRpGroup,
  type GroupKind,
  type RpGroupOption,
} from "@/lib/rp-groups";
import { MetallicButton } from "@/components/ui/metallic-button";
import { Pencil, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const SECTIONS: GroupKind[] = ["PF", "GANG", "ORGA"];
const LIST_FILTERS: Array<{ id: "ALL" | GroupKind; label: string }> = [
  { id: "ALL", label: "Tout" },
  { id: "ORGA", label: "Orga" },
  { id: "GANG", label: "Gang" },
  { id: "PF", label: "PF" },
];

const rowGrid =
  "grid grid-cols-[5.75rem_minmax(0,1fr)_6.5rem_2.5rem_2.5rem] items-center gap-1 px-1";

function persistGroup(
  fromId: string,
  patch: { name?: string; kind?: GroupKind; newId?: string }
) {
  const row = updateRpGroup(fromId, patch);
  syncGroupRewardIdentity(fromId, { id: row.id, name: row.name });
  remapMissionGroupId(fromId, row.id);
  return row;
}

function GroupRow({
  group,
  onEdit,
}: {
  group: RpGroupOption;
  onEdit: () => void;
}) {
  return (
    <li>
      <div className="rounded-xl hover:bg-white/[0.03]">
        <div className={`${rowGrid} min-h-10`}>
          <span className="px-2 text-[13px] text-white/55">
            {GROUP_KIND_LABEL[group.kind]}
          </span>
          <span className="truncate px-2.5 text-sm font-medium tracking-tight text-white">
            {group.name}
          </span>
          <span className="px-2.5 text-right font-mono text-[13px] text-white/45">
            {group.id}
          </span>
          <button
            type="button"
            title="Modifier"
            className="flex h-9 w-9 items-center justify-center justify-self-center rounded-lg text-white/35 hover:bg-white/[0.08] hover:text-white"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Supprimer"
            className="flex h-9 w-9 items-center justify-center justify-self-center rounded-lg text-rose-300/70 hover:bg-rose-500/15 hover:text-rose-100"
            onClick={() => {
              if (!window.confirm(`Supprimer ${group.name} ?`)) return;
              removeRpGroup(group.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditGroupDialog({
  group,
  stats,
  onClose,
  onSaved,
}: {
  group: RpGroupOption;
  stats: GroupCardStats | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(group.name);
  const [id, setId] = useState(group.id);
  const [kind, setKind] = useState(group.kind);
  const [error, setError] = useState<string | null>(null);
  const missionCount = stats?.count ?? 0;
  const recent = stats?.recent ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    setError(null);
    try {
      const next = persistGroup(group.id, {
        name: name.trim(),
        kind,
        newId: id.trim(),
      });
      onSaved(next.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-[#070708]/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-group-title"
        className="rg-card relative z-10 flex max-h-[min(92dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="relative overflow-hidden border-b border-white/[0.06] px-6 py-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 right-0 h-48 w-72 rounded-full bg-amber-500/[0.07] blur-3xl"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] tracking-[0.16em] text-white/50 uppercase">
                {GROUP_KIND_LABEL[group.kind]}
              </span>
              <h2
                id="edit-group-title"
                className="mt-2 truncate text-2xl font-medium tracking-tight text-white"
              >
                {group.name}
              </h2>
              <p className="mt-1 font-mono text-[13px] text-white/35">{group.id}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <p className="mb-3 text-[11px] tracking-[0.14em] text-white/30 uppercase">
              Informations
            </p>
            <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] tracking-[0.14em] text-white/30 uppercase">
                  Nom
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rg-field"
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] tracking-[0.14em] text-white/30 uppercase">
                    Type
                  </span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as GroupKind)}
                    className="rg-field cursor-pointer"
                  >
                    <option value="PF" className="bg-[#121214]">
                      PF
                    </option>
                    <option value="GANG" className="bg-[#121214]">
                      Gang
                    </option>
                    <option value="ORGA" className="bg-[#121214]">
                      Orga
                    </option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] tracking-[0.14em] text-white/30 uppercase">
                    ID
                  </span>
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="rg-field font-mono"
                  />
                </label>
              </div>
              {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
            </div>
          </section>

          <section>
            <p className="mb-3 text-[11px] tracking-[0.14em] text-white/30 uppercase">
              Statistiques
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.06] px-3 py-3.5">
                <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-sky-100/70 uppercase">
                  <OrIcon color="bleu" size={14} />
                  Or bleu
                </p>
                <p className="mt-1.5 text-2xl font-medium tabular-nums tracking-tight text-white">
                  {stats?.bleu ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-3.5">
                <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-rose-100/70 uppercase">
                  <OrIcon color="rouge" size={14} />
                  Or rouge
                </p>
                <p className="mt-1.5 text-2xl font-medium tabular-nums tracking-tight text-white">
                  {stats?.rouge ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3.5">
                <p className="text-[11px] tracking-wide text-white/40 uppercase">
                  Missions
                </p>
                <p className="mt-1.5 text-2xl font-medium tabular-nums tracking-tight text-white">
                  {missionCount}
                </p>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[11px] tracking-[0.14em] text-white/30 uppercase">
              Dernières missions
            </p>
            {recent.length ? (
              <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                {recent.map((m, i) => (
                  <li
                    key={`${group.id}-r-${i}`}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-white/85">{m.title}</p>
                      {m.date ? (
                        <p className="mt-0.5 text-[12px] text-white/30">{m.date}</p>
                      ) : null}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums text-white/75">
                      <OrIcon color={m.color} size={14} />
                      {m.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/35">
                Pas encore de mission.
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-black/20 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Supprimer ${group.name} ?`)) return;
              removeRpGroup(group.id);
              onClose();
            }}
            className="rg-btn rg-btn-danger mr-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
          <button type="button" onClick={onClose} className="rg-btn">
            Annuler
          </button>
          <MetallicButton type="button" onClick={save} label="Enregistrer" />
        </div>
      </div>
    </div>
  );
}

export function GroupsAtlasPanel() {
  const catalog = useRpGroups();
  const [rows, setRows] = useState(listGroupRewards());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | GroupKind>("ALL");
  const [name, setName] = useState("");
  const [newId, setNewId] = useState("");
  const [newKind, setNewKind] = useState<GroupKind>("GANG");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setRows(listGroupRewards());
    refresh();
    window.addEventListener("refgm:group-rewards-updated", refresh);
    return () =>
      window.removeEventListener("refgm:group-rewards-updated", refresh);
  }, []);

  const stats = useMemo(() => statsByGroupId(rows), [rows]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = catalog.filter((g) => {
      if (kindFilter !== "ALL" && g.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)
      );
    });
    return SECTIONS.map((kind) => ({
      kind,
      items: match.filter((g) => g.kind === kind),
    })).filter((section) => section.items.length > 0);
  }, [catalog, query, kindFilter]);

  const editingGroup = editingId
    ? catalog.find((g) => g.id === editingId) ?? null
    : null;

  function addGroup() {
    setError(null);
    try {
      const row = addRpGroup({
        name,
        kind: newKind,
        id: newId.trim() || undefined,
      });
      setName("");
      setNewId("");
      setEditingId(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ajouter.");
    }
  }

  return (
    <StaffPageShell
      title="Groupes"
      description="Catalogue des PF, gangs et organisations. Le crayon ouvre la fiche complète."
    >
      <div className="space-y-3">
        <div className="flex max-w-xl items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rg-field min-w-0 flex-1"
            placeholder="Chercher un nom ou un identifiant"
          />
          <select
            value={kindFilter}
            aria-label="Filtrer par type"
            onChange={(e) =>
              setKindFilter(e.target.value as "ALL" | GroupKind)
            }
            className="rg-field max-w-[7.5rem] shrink-0 cursor-pointer"
          >
            {LIST_FILTERS.map((opt) => (
              <option
                key={opt.id}
                value={opt.id}
                className="bg-[#121214] text-white"
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex max-w-3xl flex-wrap items-center gap-2">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as GroupKind)}
            className="rg-field max-w-[7rem] cursor-pointer"
          >
            <option value="PF" className="bg-[#121214] text-white">
              PF
            </option>
            <option value="GANG" className="bg-[#121214] text-white">
              Gang
            </option>
            <option value="ORGA" className="bg-[#121214] text-white">
              Orga
            </option>
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rg-field min-w-[10rem] flex-1"
            placeholder="Nouveau groupe"
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup();
            }}
          />
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="rg-field max-w-[8rem] font-mono"
            placeholder="ID"
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup();
            }}
          />
          <MetallicButton type="button" onClick={addGroup} label="Ajouter" />
        </div>
        {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
      </div>

      <section className="rg-card p-4">
        <div
          className={`${rowGrid} px-2 text-[11px] tracking-[0.14em] text-white/35 uppercase`}
        >
          <span>Type</span>
          <span>Nom</span>
          <span className="text-right">ID</span>
          <span />
          <span />
        </div>
        {grouped.length === 0 ? (
          <p className="rg-empty mt-3 text-sm text-white/40">
            Rien dans cette recherche.
          </p>
        ) : (
          <div className="mt-2 space-y-6">
            {grouped.map((section) => (
              <section key={section.kind}>
                <p className="mb-2 px-3 text-[12px] text-white/40">
                  {GROUP_KIND_LABEL[section.kind]}
                  <span className="ml-2 tabular-nums text-white/25">
                    {section.items.length}
                  </span>
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((g) => (
                    <GroupRow
                      key={g.id}
                      group={g}
                      onEdit={() => setEditingId(g.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {editingGroup ? (
        <EditGroupDialog
          key={editingGroup.id}
          group={editingGroup}
          stats={stats[editingGroup.id] ?? null}
          onClose={() => setEditingId(null)}
          onSaved={(id) => setEditingId(id)}
        />
      ) : null}
    </StaffPageShell>
  );
}
