"use client";

import { DiscordAvatar } from "@/components/actor-trace";
import { GroupKindMark } from "@/components/group-kind-tabs";
import { MetallicButton } from "@/components/ui/metallic-button";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { OrIcon } from "@/components/or-icon";
import { useRpGroups } from "@/hooks/use-rp-groups";
import {
  listGroupRewards,
  listMissionGms,
  saveGroupMission,
} from "@/lib/group-reward-log";
import { orColorForKind, orColorLabel } from "@/lib/or-rewards";
import {
  findRpGroup,
  GROUP_KIND_LABEL,
  type GroupKind,
} from "@/lib/rp-groups";
import { GM_CELL_ROLE_LABEL } from "@/lib/gm-cells";
import { isoDate } from "@/lib/referent-planning";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

export function HomeMissionLog({
  label = "Noter une mission",
  initialGroupIds,
}: {
  label?: string;
  variant?: "primary" | "ghost";
  initialGroupIds?: string[];
} = {}) {
  const user = useDashboardUser();
  const catalog = useRpGroups();
  const referentName = user.name?.trim() || "Référent";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [kind, setKind] = useState<"ALL" | GroupKind>("ALL");
  const [query, setQuery] = useState("");
  const [gmUserId, setGmUserId] = useState("");
  const [gmName, setGmName] = useState("");
  const [gmQuery, setGmQuery] = useState("");
  const [gmOpen, setGmOpen] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [browseGroups, setBrowseGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!open || !el) return;
    if (!el.open) el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, [open]);

  const selected = useMemo(
    () => catalog.filter((g) => groupIds.includes(g.id)),
    [catalog, groupIds]
  );

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of listGroupRewards()) {
      if (!ids.includes(row.groupId) && findRpGroup(row.groupId)) {
        ids.push(row.groupId);
      }
      if (ids.length >= 8) break;
    }
    return ids;
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = catalog.filter((g) => kind === "ALL" || g.kind === kind);
    const filtered = q
      ? pool.filter(
          (g) =>
            g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)
        )
      : pool;
    const pinned = recentIds
      .map((id) => filtered.find((g) => g.id === id))
      .filter((g): g is (typeof filtered)[number] => Boolean(g));
    const rest = filtered.filter((g) => !recentIds.includes(g.id));
    return [...pinned, ...rest].slice(0, 40);
  }, [catalog, kind, query, recentIds]);

  const gmCatalog = useMemo(() => (open ? listMissionGms() : []), [open]);

  const selectedNames = useMemo(
    () => new Set(selected.map((g) => g.name.trim().toLowerCase())),
    [selected]
  );

  const gmVisible = useMemo(() => {
    const q = gmQuery.trim().toLowerCase();
    const pool = q
      ? gmCatalog.filter(
          (gm) =>
            gm.displayName.toLowerCase().includes(q) ||
            gm.cells.some((name) => name.toLowerCase().includes(q))
        )
      : gmCatalog;
    return [...pool].sort((a, b) => {
      const aHit = a.cells.some((name) =>
        selectedNames.has(name.toLowerCase())
      )
        ? 0
        : 1;
      const bHit = b.cells.some((name) =>
        selectedNames.has(name.toLowerCase())
      )
        ? 0
        : 1;
      if (aHit !== bHit) return aHit - bHit;
      return a.displayName.localeCompare(b.displayName, "fr");
    });
  }, [gmCatalog, gmQuery, selectedNames]);

  function reset() {
    setTitle("");
    setGroupIds(initialGroupIds ?? []);
    setKind("ALL");
    setQuery("");
    setGmUserId("");
    setGmName("");
    setGmQuery("");
    setGmOpen(false);
    setDate(isoDate(new Date()));
    setStart("");
    setAmounts(
      Object.fromEntries((initialGroupIds ?? []).map((id) => [id, ""]))
    );
    setNote("");
    setError(null);
    setBrowseGroups(!(initialGroupIds && initialGroupIds.length));
  }

  function close() {
    setOpen(false);
    reset();
  }

  function toggle(id: string) {
    setGroupIds((prev) => {
      if (prev.includes(id)) {
        setAmounts((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        const nextIds = prev.filter((x) => x !== id);
        if (!nextIds.length) setBrowseGroups(true);
        return nextIds;
      }
      setAmounts((current) => {
        const seed =
          Object.values(current).find((value) => value.trim()) ?? "";
        return { ...current, [id]: current[id] ?? seed };
      });
      return [...prev, id];
    });
  }

  function setAmount(id: string, value: string) {
    setAmounts((current) => ({ ...current, [id]: value }));
  }

  function applyAmountToColor(color: "bleu" | "rouge", value: string) {
    setAmounts((current) => {
      const next = { ...current };
      for (const group of selected) {
        if (orColorForKind(group.kind) === color) next[group.id] = value;
      }
      return next;
    });
  }

  function pickGm(next: { userId: string; displayName: string }) {
    setGmUserId(next.userId);
    setGmName(next.displayName);
    setGmQuery("");
    setGmOpen(false);
    setError(null);
  }

  function save() {
    setError(null);
    if (!gmName.trim()) {
      setError("Choisis un GameMaster.");
      setGmOpen(true);
      return;
    }
    if (!selected.length) {
      setError("Choisis au moins un groupe.");
      return;
    }
    const created = saveGroupMission({
      title,
      groupIds,
      date,
      startTime: start,
      rewards: note,
      amounts: Object.fromEntries(
        selected.map((group) => [group.id, Number(amounts[group.id]) || 0])
      ),
      gmName,
      gmUserId: gmUserId || null,
      loggedBy: user.id,
      loggedByName: referentName,
    });
    if (!created.length) {
      setError("Impossible d’enregistrer.");
      return;
    }
    close();
    setToast("Mission notée.");
    window.setTimeout(() => setToast(null), 2200);
  }

  const bleuGroups = selected.filter((g) => orColorForKind(g.kind) === "bleu");
  const rougeGroups = selected.filter((g) => orColorForKind(g.kind) === "rouge");
  const bleuTotal = bleuGroups.reduce(
    (n, g) => n + (Number(amounts[g.id]) || 0),
    0
  );
  const rougeTotal = rougeGroups.reduce(
    (n, g) => n + (Number(amounts[g.id]) || 0),
    0
  );

  return (
    <>
      <MetallicButton
        type="button"
        className="shrink-0"
        label={label}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      />
      {toast ? (
        <span className="text-xs text-emerald-300">{toast}</span>
      ) : null}

      {open ? (
        <dialog
          ref={dialogRef}
          aria-labelledby="mission-log-title"
          className="fixed inset-0 z-[100] m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-3 text-white backdrop:bg-black/75 open:flex open:items-end open:justify-center sm:open:items-center"
          onClose={() => {
            if (open) close();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="document"
            className="relative z-10 flex max-h-[min(92dvh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111113] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p id="mission-log-title" className="text-lg font-semibold">
                  Noter une mission
                </p>
                <p className="text-xs text-white/40">
                  GameMaster obligatoire. L’or bleu et l’or rouge se notent
                  séparément, groupe par groupe.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rg-field py-3 text-[15px]"
                placeholder="Nom de la mission"
              />

              <div className="space-y-2">
                <p className="text-[11px] tracking-[0.14em] text-white/35 uppercase">
                  GameMaster <span className="text-rose-300/80">*</span>
                </p>
                {gmOpen ? (
                  <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                    <div className="flex items-center gap-1 border-b border-white/[0.06] pr-1">
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input
                          value={gmQuery}
                          onChange={(e) => setGmQuery(e.target.value)}
                          className="rg-field rg-field-icon border-0 bg-transparent py-2.5"
                          placeholder="Chercher un GameMaster"
                          autoFocus
                        />
                      </div>
                      {gmName ? (
                        <button
                          type="button"
                          onClick={() => setGmOpen(false)}
                          className="rounded-lg p-2 text-white/35 hover:text-white"
                          aria-label="Fermer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <ul className="max-h-56 overflow-y-auto">
                      {gmVisible.length === 0 ? (
                        <li className="px-3 py-4 text-sm text-white/40">
                          Aucun GameMaster trouvé.
                        </li>
                      ) : (
                        gmVisible.map((gm) => {
                          const on =
                            (gmUserId && gm.userId === gmUserId) ||
                            (!gmUserId && gm.displayName === gmName);
                          const role = gm.role
                            ? GM_CELL_ROLE_LABEL[gm.role]
                            : "";
                          const cell = gm.cells[0] ?? "";
                          const extra =
                            gm.cells.length > 1 ? ` +${gm.cells.length - 1}` : "";
                          const hint = [role, cell].filter(Boolean).join(" · ");
                          return (
                            <li key={`${gm.userId}-${gm.displayName}`}>
                              <button
                                type="button"
                                onClick={() => pickGm(gm)}
                                className={cn(
                                  "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                                  on
                                    ? "bg-white/[0.08]"
                                    : "hover:bg-white/[0.04]"
                                )}
                              >
                                <DiscordAvatar
                                  name={gm.displayName}
                                  userId={
                                    gm.userId || gm.discordId || undefined
                                  }
                                  size={32}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-white">
                                    {gm.displayName}
                                  </span>
                                  {hint ? (
                                    <span className="block truncate text-[11px] text-white/35">
                                      {hint}
                                      {extra}
                                    </span>
                                  ) : (
                                    <span className="block text-[11px] text-white/30">
                                      GameMaster
                                    </span>
                                  )}
                                </span>
                                {on ? (
                                  <Check className="h-4 w-4 text-white" />
                                ) : null}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ) : gmName ? (
                  <button
                    type="button"
                    onClick={() => setGmOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-left"
                  >
                    <DiscordAvatar
                      name={gmName}
                      userId={gmUserId || undefined}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">
                        {gmName}
                      </span>
                      <span className="block truncate text-[11px] text-white/35">
                        {(() => {
                          const gm = gmCatalog.find(
                            (row) =>
                              (gmUserId && row.userId === gmUserId) ||
                              row.displayName === gmName
                          );
                          const role = gm?.role
                            ? GM_CELL_ROLE_LABEL[gm.role]
                            : "";
                          const cell = gm?.cells[0] ?? "";
                          return [role, cell].filter(Boolean).join(" · ") ||
                            "GameMaster";
                        })()}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/35" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGmOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-white/45 hover:text-white"
                  >
                    Choisir un GameMaster
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] tracking-[0.14em] text-white/35 uppercase">
                    Groupes <span className="text-rose-300/80">*</span>
                  </p>
                  {selected.length ? (
                    <button
                      type="button"
                      onClick={() => setBrowseGroups((v) => !v)}
                      className="text-[12px] text-white/45 hover:text-white"
                    >
                      {browseGroups ? "Masquer" : "Ajouter / retirer"}
                    </button>
                  ) : null}
                </div>
                {!selected.length || browseGroups ? (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {(["ALL", "PF", "GANG", "ORGA"] as const).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setKind(id)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs",
                            kind === id
                              ? "bg-white text-[#0a0a0b]"
                              : "text-white/40 hover:text-white"
                          )}
                        >
                          {id === "ALL" ? "Tous" : GROUP_KIND_LABEL[id]}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="rg-field rg-field-icon py-2.5 pr-3"
                        placeholder="Chercher un groupe"
                      />
                    </div>
                    <ul className="max-h-36 overflow-y-auto rounded-2xl border border-white/[0.06] bg-black/20">
                      {visible.length === 0 ? (
                        <li className="px-3 py-4 text-sm text-white/40">
                          Aucun groupe.
                        </li>
                      ) : (
                        visible.map((g) => {
                          const on = groupIds.includes(g.id);
                          return (
                            <li key={g.id}>
                              <button
                                type="button"
                                onClick={() => toggle(g.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                                  on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    on ? "bg-white" : "bg-white/20"
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {g.name}
                                </span>
                                <GroupKindMark kind={g.kind} />
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-white/50">
                    {selected.length} groupe
                    {selected.length > 1 ? "s" : ""} sélectionné
                    {selected.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {selected.length ? (
                <div className="space-y-3">
                  {(
                    [
                      {
                        color: "bleu" as const,
                        groups: bleuGroups,
                        total: bleuTotal,
                        hint: "PF",
                      },
                      {
                        color: "rouge" as const,
                        groups: rougeGroups,
                        total: rougeTotal,
                        hint: "Gang & orga",
                      },
                    ] as const
                  )
                    .filter((block) => block.groups.length)
                    .map((block) => (
                      <div key={block.color} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <OrIcon color={block.color} size={16} />
                          <p className="min-w-0 flex-1 text-[12px] text-white/70">
                            {orColorLabel(block.color)}
                            <span className="ml-1.5 text-white/30">
                              {block.hint}
                            </span>
                          </p>
                          <span className="text-[12px] tabular-nums text-white/40">
                            {block.total || ""}
                          </span>
                          {block.groups.length > 1 ? (
                            <input
                              type="number"
                              min={0}
                              aria-label={`Même montant ${orColorLabel(block.color)}`}
                              className="w-[4.75rem] shrink-0 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-right text-xs tabular-nums outline-none focus:border-white/25"
                              placeholder="tous"
                              onChange={(e) =>
                                applyAmountToColor(block.color, e.target.value)
                              }
                            />
                          ) : null}
                        </div>
                        <ul className="space-y-1.5">
                          {block.groups.map((g) => (
                            <li
                              key={g.id}
                              className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-2 pr-2 pl-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-white">
                                  {g.name}
                                </p>
                                <p className="text-[11px] text-white/35">
                                  {GROUP_KIND_LABEL[g.kind]}
                                </p>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={amounts[g.id] ?? ""}
                                onChange={(e) => setAmount(g.id, e.target.value)}
                                className="w-[5.5rem] shrink-0 rounded-xl border border-white/10 bg-black/50 px-2.5 py-2 text-right text-sm tabular-nums outline-none focus:border-white/25"
                                placeholder="0"
                              />
                              <button
                                type="button"
                                title="Retirer"
                                onClick={() => toggle(g.id)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/25 hover:text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rg-field py-2.5"
                />
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rg-field py-2.5"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rg-field col-span-2 py-2.5"
                  placeholder="Note (optionnel)"
                />
              </div>
              {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
            </div>

            <div className="border-t border-white/[0.06] px-5 py-4">
              <MetallicButton
                type="button"
                label={
                  selected.length
                    ? `Enregistrer · ${selected.length} groupe${selected.length > 1 ? "s" : ""}`
                    : "Enregistrer"
                }
                onClick={save}
              />
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
