"use client";

import { listMissions, type StoredMission } from "@/lib/mission-storage";
import { OrIcon } from "@/components/or-icon";
import { orColorLabel, type OrColor } from "@/lib/or-rewards";
import {
  GROUP_KIND_LABEL,
  findRpGroup,
  type GroupKind,
  type RpGroupOption,
} from "@/lib/rp-groups";
import {
  addWelcomedGroup,
  deleteWelcomedGroup,
  listWelcomedGroups,
  type WelcomedGroup,
} from "@/lib/welcomed-groups";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Clock,
  FilePenLine,
  Inbox,
  Plus,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAccount } from "@/components/account-context";
import { canAccessStaffTools } from "@/lib/permissions";

type MissionedGroup = RpGroupOption & {
  missionCount: number;
  missions: StoredMission[];
  lastMissionAt: string;
  orBleu: number;
  orRouge: number;
  orColor: OrColor;
  history: { label: string; or: number; date: string }[];
};

const KIND_ORDER: GroupKind[] = ["PF", "GANG", "ORGA"];

const KIND_STYLE: Record<
  GroupKind,
  { badge: string; glow: string; accent: string; chart: string }
> = {
  PF: {
    badge: "border-violet-400/25 bg-violet-500/10 text-violet-100/90",
    glow: "bg-violet-500/15",
    accent: "border-violet-400/20",
    chart: "#38bdf8",
  },
  GANG: {
    badge: "border-rose-400/25 bg-rose-500/10 text-rose-100/90",
    glow: "bg-rose-500/15",
    accent: "border-rose-400/20",
    chart: "#fb7185",
  },
  ORGA: {
    badge: "border-amber-400/25 bg-amber-500/10 text-amber-100/90",
    glow: "bg-amber-500/15",
    accent: "border-amber-400/20",
    chart: "#fbbf24",
  },
};

function buildMissionedGroups(missions: StoredMission[]): MissionedGroup[] {
  const map = new Map<string, MissionedGroup>();

  for (const mission of missions) {
    if (mission.noGroup || mission.groupIds.length === 0) continue;
    for (const groupId of mission.groupIds) {
      const meta = findRpGroup(groupId);
      if (!meta) continue;

      const reward = mission.orRewards?.find((r) => r.groupId === groupId);
      const amount = reward?.amount ?? 0;
      const color = reward?.color ?? (meta.kind === "PF" ? "bleu" : "rouge");

      const existing = map.get(groupId);
      const point = {
        label: new Date(mission.updatedAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        or: amount,
        date: mission.updatedAt,
      };

      if (existing) {
        existing.missionCount += 1;
        existing.missions.push(mission);
        existing.history.push(point);
        if (color === "bleu") existing.orBleu += amount;
        else existing.orRouge += amount;
        if (
          new Date(mission.updatedAt).getTime() >
          new Date(existing.lastMissionAt).getTime()
        ) {
          existing.lastMissionAt = mission.updatedAt;
        }
      } else {
        map.set(groupId, {
          ...meta,
          missionCount: 1,
          missions: [mission],
          lastMissionAt: mission.updatedAt,
          orBleu: color === "bleu" ? amount : 0,
          orRouge: color === "rouge" ? amount : 0,
          orColor: color,
          history: [point],
        });
      }
    }
  }

  for (const g of map.values()) {
    g.history.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    // courbe cumulée
    let running = 0;
    g.history = g.history.map((h) => {
      running += h.or;
      return { ...h, or: running };
    });
  }

  return [...map.values()].sort((a, b) => {
    const kindDiff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindDiff !== 0) return kindDiff;
    const aOr = a.orBleu + a.orRouge;
    const bOr = b.orBleu + b.orRouge;
    return bOr - aOr || a.name.localeCompare(b.name, "fr");
  });
}

export function GroupsPanel() {
  const { account, grade } = useAccount();
  const canWelcome = canAccessStaffTools(grade);
  const [missions, setMissions] = useState<StoredMission[]>([]);
  const [activeKind, setActiveKind] = useState<GroupKind | "ALL">("ALL");
  const [selected, setSelected] = useState<MissionedGroup | null>(null);
  const [welcomed, setWelcomed] = useState<WelcomedGroup[]>([]);
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeKind, setWelcomeKind] = useState<GroupKind>("GANG");
  const [welcomeNote, setWelcomeNote] = useState("");

  const refresh = useCallback(() => {
    setMissions(listMissions());
    setWelcomed(listWelcomedGroups());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:missions-updated", onUpdate);
    window.addEventListener("refgm:staff-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("refgm:missions-updated", onUpdate);
      window.removeEventListener("refgm:staff-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Keep selected in sync after refresh
  useEffect(() => {
    if (!selected) return;
    const next = buildMissionedGroups(missions).find((g) => g.id === selected.id);
    if (next) setSelected(next);
  }, [missions, selected?.id]);

  const missioned = useMemo(
    () => buildMissionedGroups(missions),
    [missions]
  );

  const byKind = useMemo(() => {
    const groups: Record<GroupKind, MissionedGroup[]> = {
      PF: [],
      GANG: [],
      ORGA: [],
    };
    for (const g of missioned) {
      if (activeKind !== "ALL" && g.kind !== activeKind) continue;
      groups[g.kind].push(g);
    }
    return groups;
  }, [missioned, activeKind]);

  const totalVisible =
    byKind.PF.length + byKind.GANG.length + byKind.ORGA.length;

  const counts = useMemo(
    () => ({
      ALL: missioned.length,
      PF: missioned.filter((g) => g.kind === "PF").length,
      GANG: missioned.filter((g) => g.kind === "GANG").length,
      ORGA: missioned.filter((g) => g.kind === "ORGA").length,
    }),
    [missioned]
  );

  return (
    <div className="lab-bg relative min-h-dvh overflow-hidden bg-transparent p-6 text-white">
      <div className="relative z-10 mx-auto w-full max-w-4xl space-y-7 pt-4 pb-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Groupes
          </h1>
          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#8a8a93]">
            <span className="inline-flex items-center gap-1.5">
              PF → <OrIcon color="bleu" size={16} /> Or bleu
            </span>
            <span className="text-white/20">·</span>
            <span className="inline-flex items-center gap-1.5">
              Gang / Orga → <OrIcon color="rouge" size={16} /> Or rouge
            </span>
          </p>
        </div>

        {canWelcome ? (
          <section className="rg-card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <p className="text-sm font-medium text-white">
                Nouveau groupe sur le serveur
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={welcomeName}
                onChange={(e) => setWelcomeName(e.target.value)}
                placeholder="Nom du groupe"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <select
                value={welcomeKind}
                onChange={(e) => setWelcomeKind(e.target.value as GroupKind)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="GANG">Gang</option>
                <option value="ORGA">Orga</option>
                <option value="PF">PF</option>
              </select>
              <button
                type="button"
                disabled={!welcomeName.trim()}
                onClick={() => {
                  addWelcomedGroup({
                    name: welcomeName,
                    kind: welcomeKind,
                    note: welcomeNote,
                    welcomedBy: account.displayName,
                  });
                  setWelcomeName("");
                  setWelcomeNote("");
                  refresh();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#0a0a0b] shadow-lg shadow-white/10 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Bienvenue
              </button>
            </div>
            <input
              value={welcomeNote}
              onChange={(e) => setWelcomeNote(e.target.value)}
              placeholder="Note optionnelle (parrain, zone…)"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            />
            {welcomed.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {welcomed.slice(0, 12).map((w) => (
                  <div
                    key={w.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/75"
                  >
                    <span className="text-[#8a8a93]">{w.kind}</span>
                    {w.name}
                    <button
                      type="button"
                      onClick={() => {
                        deleteWelcomedGroup(w.id);
                        refresh();
                      }}
                      className="text-white/30 hover:text-white"
                      aria-label="Retirer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : welcomed.length > 0 ? (
          <section className="rg-card p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-[#8a8a93]">
              Bienvenue sur le serveur
            </p>
            <div className="flex flex-wrap gap-2">
              {welcomed.slice(0, 16).map((w) => (
                <span
                  key={w.id}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/75"
                >
                  <span className="text-[#8a8a93]">{w.kind} · </span>
                  {w.name}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["ALL", "Tous"],
              ["PF", "PF"],
              ["GANG", "Gang"],
              ["ORGA", "Orga"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKind(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeKind === key
                  ? "bg-white text-[#0a0a0b]"
                  : "border border-white/10 bg-[#1a1a1e] text-white/70 hover:text-white"
              )}
            >
              {label}
              <span className="ml-1.5 opacity-70">{counts[key]}</span>
            </button>
          ))}
          <Link
            href="/dashboard"
            className="ml-auto rounded-full border border-white/10 bg-[#1a1a1e] px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            File missions
          </Link>
        </div>

        {totalVisible === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center"
          >
            <Inbox className="mb-4 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/60">Aucun groupe missionné</p>
            <p className="mt-1 text-xs text-white/35">
              Dès qu’une mission inclut un groupe, l’Or et les stats apparaîtront
              ici
            </p>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {KIND_ORDER.map((kind) => {
              const list = byKind[kind];
              if (list.length === 0) return null;
              const style = KIND_STYLE[kind];
              const orLabel = kind === "PF" ? "Or Bleu" : "Or Rouge";
              return (
                <section key={kind} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase",
                        style.badge
                      )}
                    >
                      <OrIcon
                        color={kind === "PF" ? "bleu" : "rouge"}
                        size={14}
                      />
                      {GROUP_KIND_LABEL[kind]} · {orLabel}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                    <span className="text-[11px] text-white/30">
                      {list.length} groupe{list.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((group, index) => {
                      const totalOr =
                        group.orColor === "bleu"
                          ? group.orBleu
                          : group.orRouge;
                      return (
                        <motion.button
                          key={group.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => setSelected(group)}
                          className={cn(
                            "rg-card group cursor-pointer p-4 text-left transition-colors hover:border-violet-400/35",
                            style.accent
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {group.name}
                              </p>
                              <p className="mt-1 text-[11px] text-[#8a8a93]">
                                #{group.id.replace(/-.*$/, "")} ·{" "}
                                {group.missionCount > 1
                                  ? `${group.missionCount} missions`
                                  : "1 mission"}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-white/25 group-hover:text-violet-300" />
                          </div>
                          <div className="mt-3 flex items-center justify-end">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-sm font-semibold",
                                group.orColor === "bleu"
                                  ? "text-violet-300"
                                  : "text-rose-300"
                              )}
                            >
                              <OrIcon color={group.orColor} size={16} />+
                              {totalOr}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 bg-[#0A0A0B]/75 backdrop-blur-md"
              onClick={() => setSelected(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative z-10 flex max-h-[min(92dvh,56rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0e]/95 shadow-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  className={cn(
                    "absolute -top-16 left-1/4 h-48 w-48 rounded-full blur-[90px]",
                    KIND_STYLE[selected.kind].glow
                  )}
                />
              </div>

              <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
                <div>
                  <span
                    className={cn(
                      "mb-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase",
                      KIND_STYLE[selected.kind].badge
                    )}
                  >
                    {GROUP_KIND_LABEL[selected.kind]}
                  </span>
                  <h2 className="text-2xl font-medium text-white/95">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-xs text-white/35">
                    #{selected.id.replace(/-.*$/, "")} · {selected.missionCount}{" "}
                    mission{selected.missionCount > 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="mb-1 text-[11px] tracking-wide text-white/35 uppercase">
                      {orColorLabel(selected.orColor)} total
                    </p>
                    <p
                      className={cn(
                        "inline-flex items-center gap-2 text-2xl font-medium",
                        selected.orColor === "bleu"
                          ? "text-violet-300"
                          : "text-rose-300"
                      )}
                    >
                      <OrIcon color={selected.orColor} size={28} />
                      {selected.orColor === "bleu"
                        ? selected.orBleu
                        : selected.orRouge}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="mb-1 text-[11px] tracking-wide text-white/35 uppercase">
                      Missions
                    </p>
                    <p className="text-2xl font-medium text-white/90">
                      {selected.missionCount}
                    </p>
                  </div>
                </div>

                <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="mb-3 text-[11px] tracking-wide text-white/35 uppercase">
                    Courbe d&apos;{orColorLabel(selected.orColor)} (cumulé)
                  </p>
                  <div className="h-52 w-full">
                    {selected.history.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selected.history}>
                          <defs>
                            <linearGradient
                              id={`or-fill-${selected.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor={KIND_STYLE[selected.kind].chart}
                                stopOpacity={0.45}
                              />
                              <stop
                                offset="100%"
                                stopColor={KIND_STYLE[selected.kind].chart}
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            stroke="rgba(255,255,255,0.06)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#111113",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 12,
                              color: "#fff",
                              fontSize: 12,
                            }}
                            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="or"
                            name={orColorLabel(selected.orColor)}
                            stroke={KIND_STYLE[selected.kind].chart}
                            fill={`url(#or-fill-${selected.id})`}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: KIND_STYLE[selected.kind].chart }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/35">
                        Pas encore de points de stats
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="text-[11px] tracking-wide text-white/35 uppercase">
                    Missions liées
                  </p>
                  {selected.missions
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.updatedAt).getTime() -
                        new Date(a.updatedAt).getTime()
                    )
                    .map((m) => {
                      const reward = m.orRewards?.find(
                        (r) => r.groupId === selected.id
                      );
                      return (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
                                m.status === "draft"
                                  ? "border-amber-400/25 bg-amber-500/10 text-amber-100/90"
                                  : "border-violet-400/25 bg-violet-500/10 text-violet-100/90"
                              )}
                            >
                              {m.status === "draft" ? (
                                <FilePenLine className="h-3 w-3" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              {m.status === "draft"
                                ? "Brouillon"
                                : "En validation"}
                            </span>
                            <span className="text-[11px] text-white/30">
                              {new Date(m.updatedAt).toLocaleString("fr-FR")}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white/90">
                            {m.title}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/35">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {m.duration}
                            </span>
                            {reward ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 font-medium",
                                  reward.color === "bleu"
                                    ? "text-violet-300"
                                    : "text-rose-300"
                                )}
                              >
                                <OrIcon color={reward.color} size={14} />+
                                {reward.amount} {orColorLabel(reward.color)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </section>
              </div>

              <div className="relative flex justify-end border-t border-white/[0.06] px-6 py-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.08]"
                >
                  <Users className="h-4 w-4" />
                  Voir Mes Missions
                </Link>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
