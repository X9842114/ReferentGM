"use client";

import { cn } from "@/lib/utils";
import {
  applyNavLayout,
  ensureLayoutOrders,
  groupLabel,
  listNavCatalog,
  type NavGroupDef,
} from "@/lib/nav-catalog";
import {
  emptyNavLayout,
  saveNavLayout,
  swapIndex,
  type NavLayout,
} from "@/lib/nav-layout";
import type { GradeId } from "@/lib/grades";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FolderPlus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type NavArrangePanelProps = {
  userId: string;
  grade: GradeId;
  layout: NavLayout;
  onChange: (next: NavLayout) => void;
  onClose: () => void;
};

export function NavArrangePanel({
  userId,
  grade,
  layout,
  onChange,
  onClose,
}: NavArrangePanelProps) {
  const catalog = useMemo(() => listNavCatalog(grade), [grade]);
  const [draftName, setDraftName] = useState("");
  const groups = useMemo(
    () => applyNavLayout(catalog, layout, { includeHidden: true }),
    [catalog, layout]
  );
  const hidden = new Set(layout.hidden);

  function commit(next: NavLayout) {
    const normalized = ensureLayoutOrders(catalog, next);
    onChange(normalized);
    saveNavLayout(userId, normalized);
  }

  function moveGroup(index: number, dir: -1 | 1) {
    commit({
      ...layout,
      groupOrder: swapIndex(
        groups.map((group) => group.id),
        index,
        dir
      ),
    });
  }

  function moveItem(group: NavGroupDef, index: number, dir: -1 | 1) {
    commit({
      ...layout,
      itemOrder: {
        ...layout.itemOrder,
        [group.id]: swapIndex(
          group.items.map((item) => item.href),
          index,
          dir
        ),
      },
    });
  }

  function sendItem(href: string, groupId: string) {
    const nextOrder = { ...layout.itemOrder };
    for (const [id, hrefs] of Object.entries(nextOrder)) {
      nextOrder[id] = hrefs.filter((value) => value !== href);
    }
    nextOrder[groupId] = [...(nextOrder[groupId] ?? []), href];
    commit({
      ...layout,
      itemGroup: { ...layout.itemGroup, [href]: groupId },
      itemOrder: nextOrder,
    });
  }

  function toggleHidden(href: string) {
    const next = hidden.has(href)
      ? layout.hidden.filter((value) => value !== href)
      : [...layout.hidden, href];
    commit({ ...layout, hidden: next });
  }

  function renameGroup(id: string, label: string) {
    commit({
      ...layout,
      groupLabels: { ...layout.groupLabels, [id]: label },
    });
  }

  function addGroup() {
    const label = draftName.trim() || `Catégorie ${layout.customGroups.length + 1}`;
    const id = `custom-${Date.now().toString(36)}`;
    setDraftName("");
    commit({
      ...layout,
      customGroups: [...layout.customGroups, { id, label }],
      groupOrder: [...groups.map((group) => group.id), id],
    });
  }

  function removeGroup(id: string) {
    if (!id.startsWith("custom-")) return;
    const fallback = "qg";
    const itemGroup = { ...layout.itemGroup };
    const group = groups.find((entry) => entry.id === id);
    for (const item of group?.items ?? []) {
      itemGroup[item.href] = item.defaultGroupId || fallback;
    }
    commit({
      ...layout,
      customGroups: layout.customGroups.filter((entry) => entry.id !== id),
      groupOrder: layout.groupOrder.filter((value) => value !== id),
      itemGroup,
      collapsed: { ...layout.collapsed, [id]: false },
    });
  }

  function reset() {
    const next = emptyNavLayout();
    onChange(next);
    saveNavLayout(userId, next);
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/55 backdrop-blur-sm">
      <button
        type="button"
        className="h-full flex-1 cursor-default"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0c0c0e] shadow-[-24px_0_80px_rgba(0,0,0,0.45)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-white/90">Agencer la barre</p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              Monte, descends, change de catégorie ou masque un lien. La barre à
              gauche se met à jour tout de suite.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {groups.map((group, groupIndex) => (
            <section
              key={group.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5"
            >
              <div className="mb-2 flex items-center gap-1">
                <MoveButtons
                  disableUp={groupIndex === 0}
                  disableDown={groupIndex === groups.length - 1}
                  onUp={() => moveGroup(groupIndex, -1)}
                  onDown={() => moveGroup(groupIndex, 1)}
                />
                <input
                  value={groupLabel(group.id, layout)}
                  onChange={(event) => renameGroup(group.id, event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 text-[12px] font-medium tracking-wide text-white/80 uppercase outline-none"
                />
                {group.id.startsWith("custom-") ? (
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded-lg p-1.5 text-white/30 hover:bg-rose-500/15 hover:text-rose-200"
                    title="Supprimer la catégorie"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                {group.items.length === 0 ? (
                  <p className="px-2 py-2 text-[11px] text-white/30">
                    Aucun lien ici. Envoie-en un depuis une autre catégorie.
                  </p>
                ) : (
                  group.items.map((item, itemIndex) => {
                    const Icon = item.icon;
                    const isHidden = hidden.has(item.href);
                    return (
                      <div
                        key={item.href}
                        className={cn(
                          "flex items-center gap-1 rounded-xl px-1 py-1",
                          isHidden ? "opacity-40" : "bg-white/[0.03]"
                        )}
                      >
                        <MoveButtons
                          disableUp={itemIndex === 0}
                          disableDown={itemIndex === group.items.length - 1}
                          onUp={() => moveItem(group, itemIndex, -1)}
                          onDown={() => moveItem(group, itemIndex, 1)}
                        />
                        <Icon
                          strokeWidth={1.75}
                          className="h-4 w-4 shrink-0 text-white/70"
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                          {item.label}
                        </span>
                        <select
                          value={group.id}
                          onChange={(event) =>
                            sendItem(item.href, event.target.value)
                          }
                          className="h-7 max-w-[7.5rem] rounded-md border border-white/10 bg-black/40 px-1 text-[10px] text-white/65 outline-none"
                          title="Déplacer vers"
                        >
                          {groups.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => toggleHidden(item.href)}
                          className="rounded-md p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/80"
                          title={isHidden ? "Afficher" : "Masquer"}
                        >
                          {isHidden ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>

        <footer className="space-y-2 border-t border-white/[0.06] px-4 py-3">
          <div className="flex gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addGroup();
              }}
              placeholder="Nouvelle catégorie"
              className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/80 outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={addGroup}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 text-xs text-white/80 hover:bg-white/[0.12]"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Ajouter
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/70"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rg-btn rg-btn-primary h-9 px-4 text-xs"
            >
              Terminé
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function MoveButtons({
  disableUp,
  disableDown,
  onUp,
  onDown,
}: {
  disableUp: boolean;
  disableDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        disabled={disableUp}
        onClick={onUp}
        className="rounded-md p-0.5 text-white/40 hover:bg-white/[0.08] hover:text-white disabled:opacity-20"
        title="Monter"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={disableDown}
        onClick={onDown}
        className="rounded-md p-0.5 text-white/40 hover:bg-white/[0.08] hover:text-white disabled:opacity-20"
        title="Descendre"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
