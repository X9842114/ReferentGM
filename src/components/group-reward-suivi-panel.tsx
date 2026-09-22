"use client";

import { EmptyHint } from "@/components/empty-hint";
import { HomeMissionLog } from "@/components/home-mission-log";
import { OrIcon } from "@/components/or-icon";
import { DiscordAvatar } from "@/components/actor-trace";
import { PersonTile } from "@/components/person-tile";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { SuiviManageActions } from "@/components/suivi-editor";
import { downloadSuiviCsv } from "@/lib/csv-export";
import {
  downloadGroupRewardsPng,
  listGroupRewards,
  recapGroupRewards,
  type GroupRewardEntry,
} from "@/lib/group-reward-log";
import {
  GM_CELL_ROLE_LABEL,
  listGmCells,
  type GmCell,
} from "@/lib/gm-cells";
import { orColorForKind } from "@/lib/or-rewards";
import { isoDate } from "@/lib/referent-planning";
import {
  GROUP_KIND_CHIP,
  GROUP_KIND_LABEL,
  GROUP_KIND_TEXT,
  findRpGroup,
  type GroupKind,
} from "@/lib/rp-groups";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Coins,
  Download,
  FileSpreadsheet,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RangePreset = "7" | "30" | "all" | "custom";
type KindFilter = "ALL" | GroupKind;

const TOOLTIP = {
  background: "rgba(12,12,14,0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  color: "#fff",
  fontSize: 12,
};

const KIND_GLOW: Record<GroupKind, string> = {
  PF: "from-sky-500/25 via-sky-500/5 to-transparent",
  GANG: "from-rose-500/25 via-rose-500/5 to-transparent",
  ORGA: "from-amber-500/25 via-amber-500/5 to-transparent",
};

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function rowDay(row: GroupRewardEntry) {
  return row.missionDate || isoDate(new Date(row.createdAt));
}

function eachDay(from: string, to: string) {
  const out: string[] = [];
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return out;
  for (let t = a.getTime(); t <= b.getTime(); t += 86_400_000) {
    out.push(isoDate(new Date(t)));
  }
  return out.length ? out : [to];
}

function tickLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatDay(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatOr(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
}

function formatOrShort(n: number) {
  const value = Math.round(n || 0);
  if (Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat("fr-FR", {
      notation: "compact",
      maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    }).format(value);
  }
  return formatOr(value);
}

function sharePct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function startOfWeekIso(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  return isoDate(d);
}

function daysInRange(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function grainForRange(from: string, to: string): "day" | "week" | "month" {
  const days = daysInRange(from, to);
  if (days <= 14) return "day";
  if (days <= 90) return "week";
  return "month";
}

function formatRangeLabel(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const fmt = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: withYear ? "numeric" : undefined,
    });
  if (!from || !to) return "";
  return `${fmt(from, !sameYear)} → ${fmt(to, true)}`;
}

function bucketKey(iso: string, grain: "day" | "week" | "month") {
  if (grain === "week") return startOfWeekIso(iso);
  if (grain === "month") return iso.slice(0, 7);
  return iso;
}

function bucketLabel(key: string, grain: "day" | "week" | "month") {
  if (grain === "day") return tickLabel(key);
  if (grain === "week") return tickLabel(key);
  const [y, m] = key.split("-");
  return new Date(`${y}-${m}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

type MissionRecap = {
  id: string;
  title: string;
  day: string;
  startTime: string;
  gms: { name: string; userId: string | null }[];
  referents: string[];
  note: string;
  bleu: number;
  rouge: number;
  source: "suivi" | "mission" | "discord";
  rewardIds: string[];
};

function cleanNote(row: GroupRewardEntry) {
  const note = row.rewardNote.trim();
  if (note) return note;
  const suivi = row.suivi.trim();
  if (!suivi || suivi.startsWith("📌")) return "";
  return suivi;
}

function missionsOf(
  rows: GroupRewardEntry[],
  _groupId: string,
  _groupName: string
): MissionRecap[] {
  const map = new Map<string, GroupRewardEntry[]>();
  for (const row of rows) {
    const key = row.batchId || row.id;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  const fromSuivi: MissionRecap[] = [...map.values()].map((mine) => {
    const head = [...mine].sort(
      (a, b) =>
        `${rowDay(b)} ${b.startTime}`.localeCompare(`${rowDay(a)} ${a.startTime}`)
    )[0];
    const gms = new Map<string, { name: string; userId: string | null }>();
    for (const row of mine) {
      const name = row.gmName.trim();
      if (!name) continue;
      const prev = gms.get(name.toLowerCase());
      gms.set(name.toLowerCase(), {
        name,
        userId: row.gmUserId || prev?.userId || null,
      });
    }
    return {
      id: head.batchId || head.id,
      title: head.missionTitle.trim() || "Mission",
      day: rowDay(head),
      startTime: head.startTime,
      gms: [...gms.values()],
      referents: [
        ...new Set(mine.map((r) => r.loggedByName.trim()).filter(Boolean)),
      ],
      note: mine.map(cleanNote).find(Boolean) || "",
      bleu: mine
        .filter((r) => r.color === "bleu")
        .reduce((n, r) => n + r.amount, 0),
      rouge: mine
        .filter((r) => r.color === "rouge")
        .reduce((n, r) => n + r.amount, 0),
      source: "suivi" as const,
      rewardIds: mine.map((r) => r.id),
    };
  });

  return fromSuivi.sort((a, b) =>
    `${b.day} ${b.startTime}`.localeCompare(`${a.day} ${a.startTime}`)
  );
}

function findCellForGroup(groupId: string, groupName: string): GmCell | null {
  const cells = listGmCells();
  const needle = groupName.trim().toLowerCase();
  return (
    cells.find((c) => c.groupName.trim().toLowerCase() === needle) ||
    cells.find((c) => c.id === groupId) ||
    null
  );
}

export function GroupRewardSuiviPanel() {
  const [rows, setRows] = useState(listGroupRewards());
  const [preset, setPreset] = useState<RangePreset>("30");
  const [from, setFrom] = useState(() => daysAgoIso(30));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");

  useEffect(() => {
    const refresh = () => setRows(listGroupRewards());
    refresh();
    window.addEventListener("refgm:group-rewards-updated", refresh);
    return () =>
      window.removeEventListener("refgm:group-rewards-updated", refresh);
  }, []);

  function applyPreset(next: Exclude<RangePreset, "custom">) {
    setPreset(next);
    const today = isoDate(new Date());
    setTo(today);
    if (next === "7") setFrom(daysAgoIso(7));
    if (next === "30") setFrom(daysAgoIso(30));
    if (next === "all") {
      const dates = listGroupRewards().map(rowDay).filter(Boolean).sort();
      setFrom(dates[0] || daysAgoIso(90));
    }
  }

  function applyCustomRange(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const start = nextFrom <= nextTo ? nextFrom : nextTo;
    const end = nextFrom <= nextTo ? nextTo : nextFrom;
    setFrom(start);
    setTo(end);
    setPreset("custom");
  }

  const inPeriod = useMemo(
    () =>
      rows.filter((row) => {
        const day = rowDay(row);
        return day >= from && day <= to;
      }),
    [rows, from, to]
  );

  const recap = useMemo(() => recapGroupRewards(inPeriod), [inPeriod]);

  const ranked = useMemo(() => {
    const byId = new Map<string, GroupRewardEntry[]>();
    for (const row of inPeriod) {
      const list = byId.get(row.groupId) ?? [];
      list.push(row);
      byId.set(row.groupId, list);
    }
    return [...byId.entries()]
      .map(([id, mine]) => {
        const catalog = findRpGroup(id);
        const kind = catalog?.kind ?? null;
        const color = kind
          ? orColorForKind(kind)
          : mine.some((r) => r.color === "rouge")
            ? "rouge"
            : "bleu";
        const gmsOn = [
          ...new Set(mine.map((r) => r.gmName.trim()).filter(Boolean)),
        ];
        return {
          id,
          name: catalog?.name || mine[0]?.groupName || id,
          kind: kind as GroupKind | null,
          color,
          gold: mine.reduce((n, r) => n + r.amount, 0),
          bleu: mine.reduce(
            (n, r) => n + (r.color === "bleu" ? r.amount : 0),
            0
          ),
          rouge: mine.reduce(
            (n, r) => n + (r.color === "rouge" ? r.amount : 0),
            0
          ),
          missions: new Set(mine.map((r) => r.batchId || r.id)).size,
          lastAt: mine.map(rowDay).sort().at(-1) || "",
          gms: gmsOn,
          rows: mine,
        };
      })
      .sort((a, b) => b.gold - a.gold);
  }, [inPeriod]);

  const q = query.trim().toLowerCase();
  const list = ranked.filter((g) => {
    if (kindFilter !== "ALL" && g.kind !== kindFilter) return false;
    if (q && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const selected = ranked.find((g) => g.id === picked) ?? null;
  const selectedMissions = useMemo(
    () =>
      selected ? missionsOf(selected.rows, selected.id, selected.name) : [],
    [selected]
  );
  const selectedCell = selected
    ? findCellForGroup(selected.id, selected.name)
    : null;
  const selectedRank = selected
    ? ranked.findIndex((g) => g.id === selected.id) + 1
    : 0;
  const avgGold =
    selected && selected.missions
      ? Math.round(selected.gold / selected.missions)
      : 0;
  const selectedGms = useMemo(() => {
    if (!selected) return [];
    const map = new Map<
      string,
      {
        name: string;
        userId: string | null;
        bleu: number;
        rouge: number;
        batches: Set<string>;
      }
    >();
    for (const row of selected.rows) {
      const name = row.gmName.trim() || "Non renseigné";
      const prev = map.get(name.toLowerCase()) ?? {
        name,
        userId: row.gmUserId,
        bleu: 0,
        rouge: 0,
        batches: new Set<string>(),
      };
      if (!prev.userId && row.gmUserId) prev.userId = row.gmUserId;
      prev.batches.add(row.batchId || row.id);
      if (row.color === "bleu") prev.bleu += row.amount;
      else prev.rouge += row.amount;
      map.set(name.toLowerCase(), prev);
    }
    return [...map.values()]
      .filter((g) => g.name !== "Non renseigné")
      .map((g) => ({
        name: g.name,
        userId: g.userId,
        bleu: g.bleu,
        rouge: g.rouge,
        count: g.batches.size,
      }))
      .sort((a, b) => b.bleu + b.rouge - (a.bleu + a.rouge));
  }, [selected]);
  const selectedDaily = useMemo(() => {
    if (!selected) return [];
    const grain = grainForRange(from, to);
    const buckets = new Map<
      string,
      { bleu: number; rouge: number; or: number; missions: Set<string> }
    >();
    for (const iso of eachDay(from, to)) {
      const key = bucketKey(iso, grain);
      if (!buckets.has(key)) {
        buckets.set(key, { bleu: 0, rouge: 0, or: 0, missions: new Set() });
      }
    }
    for (const row of selected.rows) {
      const key = bucketKey(rowDay(row), grain);
      const prev = buckets.get(key) ?? {
        bleu: 0,
        rouge: 0,
        or: 0,
        missions: new Set<string>(),
      };
      if (row.color === "bleu") prev.bleu += row.amount;
      else prev.rouge += row.amount;
      prev.or += row.amount;
      prev.missions.add(row.batchId || row.id);
      buckets.set(key, prev);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        label: bucketLabel(key, grain),
        bleu: v.bleu,
        rouge: v.rouge,
        or: v.or,
        missions: v.missions.size,
      }));
  }, [selected, from, to]);

  const chart = useMemo(() => {
    const grain = grainForRange(from, to);
    const buckets = new Map<
      string,
      { bleu: number; rouge: number; missions: Set<string> }
    >();
    for (const iso of eachDay(from, to)) {
      const key = bucketKey(iso, grain);
      if (!buckets.has(key)) {
        buckets.set(key, { bleu: 0, rouge: 0, missions: new Set() });
      }
    }
    for (const row of inPeriod) {
      const key = bucketKey(rowDay(row), grain);
      const prev = buckets.get(key) ?? {
        bleu: 0,
        rouge: 0,
        missions: new Set<string>(),
      };
      if (row.color === "bleu") prev.bleu += row.amount;
      else prev.rouge += row.amount;
      prev.missions.add(row.batchId || row.id);
      buckets.set(key, prev);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        label: bucketLabel(key, grain),
        bleu: v.bleu,
        rouge: v.rouge,
        total: v.bleu + v.rouge,
        missions: v.missions.size,
      }));
  }, [from, to, inPeriod]);

  const periodLabel =
    preset === "7"
      ? "7 derniers jours"
      : preset === "30"
        ? "30 derniers jours"
        : preset === "all"
          ? "depuis le début"
          : formatRangeLabel(from, to);
  const chartGrain =
    grainForRange(from, to) === "day"
      ? "par jour"
      : grainForRange(from, to) === "week"
        ? "par semaine"
        : "par mois";
  const todayIso = isoDate(new Date());

  const spark = chart.map((d) => d.total);
  const missionCount = new Set(inPeriod.map((r) => r.batchId || r.id)).size;
  const periodGold = recap.bleu + recap.rouge;
  const groupShare = selected ? sharePct(selected.gold, periodGold) : 0;
  const lastMissionGold = selectedMissions[0]
    ? selectedMissions[0].bleu + selectedMissions[0].rouge
    : 0;

  return (
    <StaffPageShell
      title="Suivi groupes"
      description="Cartes par groupe : clique pour les stats et l’historique des missions reçues."
      className="max-w-6xl"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <HomeMissionLog
            label="Noter une mission"
            initialGroupIds={
              selected && selected.id && !selected.id.startsWith("libre:")
                ? [selected.id]
                : undefined
            }
          />
          <button
            type="button"
            className="rg-btn"
            onClick={() => {
              const exportRows = selected ? selected.rows : inPeriod;
              const recapFor = recapGroupRewards(exportRows);
              const name = selected
                ? `suivi-${selected.name.replace(/\s+/g, "-").toLowerCase()}.png`
                : "suivi-groupes.png";
              void downloadGroupRewardsPng(
                recapFor,
                selected ? `${selected.name} · ${periodLabel}` : periodLabel,
                name,
                spark
              );
            }}
          >
            <Download className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            className="rg-btn"
            onClick={() =>
              downloadSuiviCsv(
                selected ? selected.rows : inPeriod,
                selected
                  ? `suivi-${selected.name.replace(/\s+/g, "-").toLowerCase()}.csv`
                  : "suivi-groupes.csv"
              )
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {(["7", "30", "all"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs",
              preset === p
                ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                : "border-white/10 text-white/40 hover:text-white/70"
            )}
          >
            {p === "all" ? "Tout" : `${p} j`}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-[11px] text-white/40">
          Du
          <input
            type="date"
            value={from}
            max={to || todayIso}
            onChange={(e) => applyCustomRange(e.target.value, to)}
            className={cn(
              "rg-field py-1.5 text-xs",
              preset === "custom" && "border-violet-400/40"
            )}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-white/40">
          Au
          <input
            type="date"
            value={to}
            min={from}
            max={todayIso}
            onChange={(e) => applyCustomRange(from, e.target.value)}
            className={cn(
              "rg-field py-1.5 text-xs",
              preset === "custom" && "border-violet-400/40"
            )}
          />
        </label>
        <p className="ml-auto text-[11px] text-white/30">{periodLabel}</p>
      </div>

      {!picked ? (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Missions", missionCount, Sparkles],
            ["Or bleu", recap.bleu, Coins],
            ["Or rouge", recap.rouge, Coins],
            ["Groupes", ranked.length, Users],
          ] as const
        ).map(([label, value, Icon]) => (
          <div key={label} className="rg-card relative overflow-hidden px-4 py-4">
            <Icon className="absolute top-3 right-3 h-4 w-4 text-white/15" />
            <p className="text-[11px] text-white/40">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {typeof value === "number" ? formatOrShort(value) : value}
            </p>
          </div>
        ))}
      </div>
      ) : null}

      {!inPeriod.length ? (
        <EmptyHint
          icon={<Users className="h-7 w-7" />}
          title="Aucun suivi sur cette période"
          hint="Note une mission ici ou depuis l’accueil : l’or des groupes apparaît dans ces cartes."
        />
      ) : (
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-5"
            >
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tous les groupes
              </button>

              <section
                className={cn(
                  "rg-card relative overflow-hidden p-5 sm:p-7",
                  selected.kind && `bg-gradient-to-br ${KIND_GLOW[selected.kind]}`
                )}
              >
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.04] blur-3xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.kind ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                            GROUP_KIND_CHIP[selected.kind]
                          )}
                        >
                          {GROUP_KIND_LABEL[selected.kind]}
                        </span>
                      ) : null}
                      {selectedRank ? (
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-[10px] text-white/50">
                          #{selectedRank} or sur la période
                        </span>
                      ) : null}
                      {selected.id && !selected.id.startsWith("libre:") ? (
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 font-mono text-[10px] text-white/40">
                          ID {selected.id}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-3xl font-medium tracking-tight text-white sm:text-4xl">
                      {selected.name}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-white/45">
                      {selected.missions > 1
                        ? `${selected.missions} missions reçues`
                        : "1 mission reçue"}
                      {selected.lastAt
                        ? ` · dernière le ${formatDay(selected.lastAt)}`
                        : ""}
                      {selectedCell?.qgPosition
                        ? ` · QG ${selectedCell.qgPosition}`
                        : ""}
                    </p>
                    {selectedCell?.trameLabel || selectedCell?.trameStatus ? (
                      <p className="mt-2 text-xs text-white/40">
                        Trame {selectedCell.trameLabel || "en cours"}
                        {selectedCell.trameStatus
                          ? ` · ${selectedCell.trameStatus}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-[12rem] rounded-3xl border border-white/10 bg-black/35 px-5 py-4 text-right">
                    <p className="text-[11px] tracking-wide text-white/40 uppercase">
                      Or reçu
                    </p>
                    <p
                      className="mt-1 inline-flex items-center gap-2 text-3xl font-light tabular-nums text-white sm:text-4xl"
                      title={formatOr(selected.gold)}
                    >
                      <OrIcon color={selected.color} size={28} />
                      {formatOrShort(selected.gold)}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {formatOrShort(avgGold)} / mission
                      {groupShare ? ` · ${groupShare}% du total` : ""}
                    </p>
                    <OrMixBar bleu={selected.bleu} rouge={selected.rouge} />
                  </div>
                </div>

                <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatChip
                    label="Or bleu"
                    value={selected.bleu}
                    icon={<OrIcon color="bleu" size={16} />}
                    sub={`${sharePct(selected.bleu, selected.gold)}%`}
                  />
                  <StatChip
                    label="Or rouge"
                    value={selected.rouge}
                    icon={<OrIcon color="rouge" size={16} />}
                    sub={`${sharePct(selected.rouge, selected.gold)}%`}
                  />
                  <StatChip
                    label="Missions"
                    value={selectedMissions.length}
                    icon={<Sparkles className="h-4 w-4 text-violet-300" />}
                    sub={
                      lastMissionGold
                        ? `Dernière ${formatOrShort(lastMissionGold)}`
                        : periodLabel
                    }
                  />
                  <StatChip
                    label="GameMasters"
                    value={selectedGms.length || selectedCell?.members.length || "·"}
                    icon={<Users className="h-4 w-4 text-white/40" />}
                    sub={
                      selectedGms[0]
                        ? `Top ${selectedGms[0].name}`
                        : selectedCell?.members[0]?.displayName
                    }
                  />
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
                <section className="rg-card overflow-hidden p-4 sm:p-5">
                  <div className="mb-2 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] tracking-[0.16em] text-white/35 uppercase">
                        Activité
                      </p>
                      <h3 className="text-base font-medium text-white">
                        Or reçu {chartGrain}
                      </h3>
                    </div>
                    {selectedCell?.qgPosition ? (
                      <p className="inline-flex items-center gap-1 text-[11px] text-white/35">
                        <MapPin className="h-3 w-3" />
                        {selectedCell.qgPosition}
                      </p>
                    ) : null}
                  </div>
                  <div className="h-52">
                    {selectedDaily.some((d) => d.bleu || d.rouge) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={selectedDaily}
                        margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                      >
                      <defs>
                        <linearGradient id="selFillBleu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.38} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="selFillRouge" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        width={44}
                        tickFormatter={(v) => formatOrShort(Number(v))}
                        tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP}
                        formatter={(value, name) => [
                          formatOr(Number(value ?? 0)),
                          name === "bleu" ? "Or bleu" : "Or rouge",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="bleu"
                        stroke="#7dd3fc"
                        strokeWidth={2.2}
                        fill="url(#selFillBleu)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="rouge"
                        stroke="#fda4af"
                        strokeWidth={2.2}
                        fill="url(#selFillRouge)"
                        dot={false}
                      />
                      </ComposedChart>
                    </ResponsiveContainer>
                    ) : (
                      <p className="grid h-full place-items-center text-sm text-white/35">
                        Pas encore d’or sur la période.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rg-card space-y-3 p-4 sm:p-5">
                  <p className="text-[11px] tracking-[0.16em] text-white/35 uppercase">
                    Équipe
                  </p>
                  {selectedGms.length ? (
                    <ul className="space-y-2">
                      {selectedGms.map((gm) => {
                        const gold = gm.bleu + gm.rouge;
                        return (
                          <li
                            key={gm.name}
                            className="rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <DiscordAvatar
                                name={gm.name}
                                userId={gm.userId}
                                size={36}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm text-white">
                                    {gm.name}
                                  </span>
                                  <span
                                    className="shrink-0 text-[11px] tabular-nums text-white/70"
                                    title={formatOr(gold)}
                                  >
                                    {formatOrShort(gold)}
                                  </span>
                                </span>
                                <span className="text-[10px] text-white/40">
                                  {gm.count > 1
                                    ? `${gm.count} missions`
                                    : `${gm.count} mission`}
                                  {selected.gold
                                    ? ` · ${sharePct(gold, selected.gold)}%`
                                    : ""}
                                </span>
                                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                  <span
                                    className="block h-full rounded-full bg-white/35"
                                    style={{
                                      width: `${Math.max(4, sharePct(gold, selected.gold || gold))}%`,
                                    }}
                                  />
                                </span>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : selectedCell?.members.length ? (
                    <div className="space-y-2">
                      {selectedCell.members.map((m) => (
                        <PersonTile
                          key={m.userId || m.displayName}
                          name={m.displayName}
                          role={GM_CELL_ROLE_LABEL[m.cellRole]}
                          userId={m.discordId || m.userId}
                          className="min-w-0 max-w-none w-full"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">
                      {selectedMissions.some((m) => m.referents.length)
                        ? `Noté par ${[
                            ...new Set(
                              selectedMissions.flatMap((m) => m.referents)
                            ),
                          ].join(", ")}`
                        : "Aucun GM renseigné pour ces missions."}
                    </p>
                  )}
                </section>
              </div>

              <section>
                <div className="mb-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] tracking-[0.16em] text-white/35 uppercase">
                      Historique
                    </p>
                    <h3 className="text-lg font-medium text-white">
                      Missions reçues
                    </h3>
                  </div>
                  <p className="text-xs text-white/35">
                    {selectedMissions.length > 1
                      ? `${selectedMissions.length} entrées`
                      : `${selectedMissions.length} entrée`}
                  </p>
                </div>
                {selectedMissions.length ? (
                  <div className="space-y-2.5">
                    {selectedMissions.map((mission) => {
                      const accent = mission.rouge && !mission.bleu
                        ? "from-rose-500/25"
                        : mission.bleu && !mission.rouge
                          ? "from-sky-500/25"
                          : mission.bleu || mission.rouge
                            ? "from-violet-500/20"
                            : "from-white/10";
                      return (
                      <article
                        key={mission.id}
                        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b to-transparent",
                            accent
                          )}
                        />
                        <div className="flex flex-col gap-3 py-4 pr-4 pl-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[15px] font-semibold tracking-tight text-white">
                                {mission.title}
                              </p>
                              {mission.source !== "suivi" ? (
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] tracking-wide text-white/40 uppercase">
                                  {mission.source === "discord"
                                    ? "Discord"
                                    : "Atelier"}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/42">
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-white/28" />
                                {formatDay(mission.day)}
                                {mission.startTime
                                  ? ` · ${mission.startTime}`
                                  : ""}
                              </span>
                              {mission.referents.length ? (
                                <span>Réf. {mission.referents.join(", ")}</span>
                              ) : null}
                            </p>
                            {mission.gms.length ? (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {mission.gms.map((gm) => (
                                  <span
                                    key={`${mission.id}-${gm.name}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 py-0.5 pr-2.5 pl-0.5 text-[11px] text-white/75"
                                  >
                                    <DiscordAvatar
                                      name={gm.name}
                                      userId={gm.userId}
                                      size={22}
                                    />
                                    {gm.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {mission.note ? (
                              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/48">
                                {mission.note}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                            <div className="flex flex-col items-end gap-1">
                              {mission.bleu ? (
                                <span className="inline-flex items-center gap-1 text-base font-medium tabular-nums text-sky-100">
                                  <OrIcon color="bleu" size={16} />
                                  {formatOrShort(mission.bleu)}
                                </span>
                              ) : null}
                              {mission.rouge ? (
                                <span className="inline-flex items-center gap-1 text-base font-medium tabular-nums text-rose-100">
                                  <OrIcon color="rouge" size={16} />
                                  {formatOrShort(mission.rouge)}
                                </span>
                              ) : null}
                              {!mission.bleu && !mission.rouge ? (
                                <span className="text-[11px] text-white/30">
                                  Or non noté
                                </span>
                              ) : null}
                            </div>
                            {mission.source === "suivi" ? (
                              <SuiviManageActions rewardIds={mission.rewardIds} />
                            ) : null}
                          </div>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rg-card px-4 py-8 text-center text-sm text-white/40">
                    Aucune mission enregistrée pour ce groupe sur la période.
                  </p>
                )}
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-5"
            >
              <section className="rg-card overflow-hidden">
                <div className="px-5 pt-5">
                  <p className="text-[11px] tracking-[0.16em] text-white/30 uppercase">
                    {periodLabel}
                  </p>
                  <p className="mt-1 text-4xl font-light tracking-tight text-white" title={formatOr(periodGold)}>
                    {formatOrShort(periodGold)}
                    <span className="ml-2 text-base text-white/35">or</span>
                  </p>
                  <div className="mt-3 max-w-sm">
                    <OrMixBar bleu={recap.bleu} rouge={recap.rouge} />
                  </div>
                  <p className="mt-2 text-xs text-white/35">
                    {formatOr(recap.bleu)} bleu · {formatOr(recap.rouge)} rouge
                    {missionCount
                      ? ` · ${formatOrShort(Math.round(periodGold / missionCount))} / mission`
                      : ""}
                  </p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chart}
                      margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="fillBleu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.38} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fillRouge" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={22}
                      />
                      <YAxis
                        width={44}
                        tickFormatter={(v) => formatOrShort(Number(v))}
                        tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP}
                        formatter={(value, name) => [
                          formatOr(Number(value ?? 0)),
                          name === "bleu" ? "Or bleu" : "Or rouge",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="bleu"
                        stroke="#7dd3fc"
                        strokeWidth={2.2}
                        fill="url(#fillBleu)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="rouge"
                        stroke="#fda4af"
                        strokeWidth={2.2}
                        fill="url(#fillRouge)"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-2">
                {(["ALL", "PF", "GANG", "ORGA"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px]",
                      kindFilter === k
                        ? k === "ALL"
                          ? "border-white/25 bg-white/10 text-white"
                          : GROUP_KIND_CHIP[k]
                        : "border-white/10 text-white/40 hover:text-white/70"
                    )}
                  >
                    {k === "ALL" ? "Tous" : GROUP_KIND_LABEL[k]}
                  </button>
                ))}
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Chercher un groupe"
                    className="rg-field rg-field-icon py-2 pr-3"
                  />
                </div>
              </div>

              {list.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPicked(g.id)}
                      className="rg-card rg-lift group relative overflow-hidden p-4 text-left"
                    >
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-80",
                          g.kind ? KIND_GLOW[g.kind] : "from-violet-500/20 to-transparent"
                        )}
                      />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-2">
                          {g.kind ? (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                GROUP_KIND_CHIP[g.kind]
                              )}
                            >
                              {GROUP_KIND_LABEL[g.kind]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/35">Groupe</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-lg font-semibold tabular-nums text-white" title={formatOr(g.gold)}>
                            <OrIcon color={g.color} size={16} />
                            {formatOrShort(g.gold)}
                          </span>
                        </div>
                        <p className="mt-3 truncate text-lg font-semibold text-white">
                          {g.name}
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">
                          {g.missions > 1
                            ? `${g.missions} missions`
                            : `${g.missions} mission`}
                          {g.lastAt ? ` · ${formatDay(g.lastAt)}` : ""}
                        </p>
                        <div className="mt-4 flex items-center gap-3 text-[11px] text-white/45">
                          {g.bleu ? (
                            <span className="inline-flex items-center gap-1">
                              <OrIcon color="bleu" size={12} />
                              {formatOrShort(g.bleu)}
                            </span>
                          ) : null}
                          {g.rouge ? (
                            <span className="inline-flex items-center gap-1">
                              <OrIcon color="rouge" size={12} />
                              {formatOrShort(g.rouge)}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "ml-auto",
                              g.kind ? GROUP_KIND_TEXT[g.kind] : "text-violet-300"
                            )}
                          >
                            Ouvrir
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rg-card px-4 py-8 text-center text-sm text-white/40">
                  Aucun groupe ne correspond.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </StaffPageShell>
  );
}

function OrMixBar({ bleu, rouge }: { bleu: number; rouge: number }) {
  const total = bleu + rouge;
  if (!total) return null;
  const bleuPct = Math.max(bleu ? 3 : 0, sharePct(bleu, total));
  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        {bleu ? (
          <span
            className="h-full bg-sky-400"
            style={{ width: `${bleuPct}%` }}
          />
        ) : null}
        {rouge ? (
          <span className="h-full flex-1 bg-rose-400" />
        ) : null}
      </div>
      <p className="mt-1.5 text-[10px] text-white/40">
        {sharePct(bleu, total)}% bleu · {sharePct(rouge, total)}% rouge
      </p>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  sub?: string;
}) {
  return (
    <div className="rg-inset px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-white/40">
        {icon}
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums text-white"
        title={typeof value === "number" ? formatOr(value) : undefined}
      >
        {typeof value === "number" ? formatOrShort(value) : value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[10px] text-white/35">{sub}</p> : null}
    </div>
  );
}
