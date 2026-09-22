"use client";

import { DiscordAvatar } from "@/components/actor-trace";
import { OrIcon } from "@/components/or-icon";
import { downloadGmPeriodCsv } from "@/lib/csv-export";
import { groupRewardsByCell, memberOwnsRow } from "@/lib/gm-cell-activity";
import { uniquePeople, usefulMemberName } from "@/lib/gm-cell-identity";
import {
  GM_CELL_ROLE_LABEL,
  listGmCells,
  type GmCell,
  type GmCellMember,
  type GmCellRoleId,
} from "@/lib/gm-cells";
import {
  downloadGmStatsPng,
  listGroupRewards,
  recapGroupRewards,
  type GroupRewardEntry,
} from "@/lib/group-reward-log";
import { orColorForKind } from "@/lib/or-rewards";
import { isoDate } from "@/lib/referent-planning";
import {
  GROUP_KIND_CHIP,
  GROUP_KIND_LABEL,
  findRpGroup,
} from "@/lib/rp-groups";
import { cn } from "@/lib/utils";
import { isDiscordSnowflake, parseDiscordId } from "@/hooks/use-discord-user";
import { Download, FileSpreadsheet, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

type RangePreset = "7" | "30" | "all" | "custom";

const ROLE_RANK: Record<GmCellRoleId, number> = {
  PRINCIPAL: 1,
  BRAS_DROIT: 2,
  BRAS_GAUCHE: 3,
};

const TOOLTIP = {
  background: "rgba(12,12,14,0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  color: "#fff",
  fontSize: 12,
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

function nameStamp(value: string) {
  const name = usefulMemberName(value);
  if (!name) return "";
  return name.length >= 6 ? name.slice(0, 6) : name;
}

function looksLikeTestGroup(name: string) {
  return /^[a-z0-9]{3,10}$/.test(name.trim());
}

function rankedMembers(cell: GmCell, cells: GmCell[] = [cell]) {
  if (looksLikeTestGroup(cell.groupName)) return [];
  const people = uniquePeople(cell.members);
  return people.filter((member) => {
    const stamp = nameStamp(member.displayName);
    const discord =
      parseDiscordId(member.discordId) || parseDiscordId(member.userId);
    const owners = cells.filter((item) =>
      item.members.some((person) => {
        const sameName = Boolean(stamp) && nameStamp(person.displayName) === stamp;
        const sameDiscord =
          Boolean(discord) &&
          (parseDiscordId(person.discordId) === discord ||
            parseDiscordId(person.userId) === discord);
        return sameName || sameDiscord;
      })
    );
    if (owners.length <= 1) return true;
    const winner = [...owners].sort((a, b) => {
      const aTest = looksLikeTestGroup(a.groupName);
      const bTest = looksLikeTestGroup(b.groupName);
      if (aTest !== bTest) return aTest ? 1 : -1;
      return (a.createdAt || "9999").localeCompare(b.createdAt || "9999");
    })[0];
    return winner?.id === cell.id;
  });
}

function RankFace({
  member,
  size,
  className,
  link = true,
}: {
  member: GmCellMember;
  size: number;
  className?: string;
  link?: boolean;
}) {
  const discordId =
    parseDiscordId(member.discordId) || parseDiscordId(member.userId);
  const avatarId = isDiscordSnowflake(discordId)
    ? discordId
    : member.discordId || member.userId;
  const rank = ROLE_RANK[member.cellRole];
  const href =
    link && member.userId
      ? `/dashboard/referents/${member.userId}`
      : link && member.discordId
        ? `/dashboard/referents/${member.discordId}`
        : null;
  const badge = (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <DiscordAvatar
          name={member.displayName}
          userId={avatarId}
          size={size}
          plain
        />
      </span>
      <span
        className="absolute right-0 bottom-0 z-10 grid place-items-center rounded-full border border-black/70 bg-violet-600 font-semibold leading-none text-white"
        style={{
          width: Math.max(16, Math.round(size * 0.4)),
          height: Math.max(16, Math.round(size * 0.4)),
          fontSize: Math.max(10, Math.round(size * 0.24)),
        }}
      >
        {rank}
      </span>
    </span>
  );
  if (!href) return badge;
  return (
    <Link
      href={href}
      title={`${rank}. ${member.displayName}`}
      className="relative inline-flex shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {badge}
    </Link>
  );
}

export function GmMissionActivity() {
  const [rows, setRows] = useState<GroupRewardEntry[]>([]);
  const [cells, setCells] = useState<GmCell[]>([]);
  const [preset, setPreset] = useState<RangePreset>("30");
  const [from, setFrom] = useState(() => daysAgoIso(29));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [picked, setPicked] = useState("");

  useEffect(() => {
    const refresh = () => {
      setRows(listGroupRewards());
      setCells(listGmCells());
    };
    refresh();
    const events = [
      "refgm:group-rewards-updated",
      "refgm:staff-updated",
      "refgm:discord-missions-updated",
    ];
    for (const event of events) window.addEventListener(event, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      for (const event of events) window.removeEventListener(event, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function applyPreset(p: RangePreset) {
    setPreset(p);
    const today = isoDate(new Date());
    setTo(today);
    if (p === "7") setFrom(daysAgoIso(6));
    else if (p === "30") setFrom(daysAgoIso(29));
    else if (p === "all") {
      const oldest = rows.map(rowDay).filter(Boolean).sort()[0];
      setFrom(oldest || daysAgoIso(365));
    }
  }

  const inPeriod = useMemo(
    () =>
      rows.filter((row) => {
        const day = rowDay(row);
        return day >= from && day <= to;
      }),
    [rows, from, to]
  );

  const cellStats = useMemo(() => {
    const assigned = groupRewardsByCell(cells, inPeriod);
    return cells
      .map((cell) => {
        const mine = assigned.get(cell.id) ?? [];
        const gold = mine.reduce((n, r) => n + r.amount, 0);
        const missions = new Set(mine.map((r) => r.batchId || r.id)).size;
        const bleu = mine
          .filter((r) => r.color === "bleu")
          .reduce((n, r) => n + r.amount, 0);
        const rouge = mine
          .filter((r) => r.color === "rouge")
          .reduce((n, r) => n + r.amount, 0);
        return { cell, rows: mine, gold, missions, bleu, rouge };
      })
      .sort(
        (a, b) =>
          b.missions - a.missions ||
          b.gold - a.gold ||
          a.cell.groupName.localeCompare(b.cell.groupName, "fr")
      );
  }, [cells, inPeriod]);
  const selected = useMemo(
    () => cellStats.find((c) => c.cell.id === picked) ?? null,
    [cellStats, picked]
  );

  useEffect(() => {
    if (picked && cellStats.some((c) => c.cell.id === picked)) return;
    const first = cellStats[0];
    if (first) setPicked(first.cell.id);
  }, [cellStats, picked]);

  const gmRows = selected?.rows ?? [];
  const gmRecap = useMemo(() => recapGroupRewards(gmRows), [gmRows]);
  const groups = useMemo(
    () =>
      gmRecap.byGroup
        .slice()
        .sort(
          (a, b) => b.count - a.count || b.bleu + b.rouge - (a.bleu + a.rouge)
        ),
    [gmRecap]
  );

  const memberStats = useMemo(() => {
    if (!selected) return [];
    return rankedMembers(selected.cell, cells).map((member) => {
      const mine = gmRows.filter((row) => memberOwnsRow(member, row));
      return {
        member,
        missions: new Set(mine.map((r) => r.batchId || r.id)).size,
        gold: mine.reduce((n, r) => n + r.amount, 0),
      };
    });
  }, [selected, gmRows, cells]);

  const chart = useMemo(() => {
    const days = eachDay(from, to);
    const dense =
      days.length > 90
        ? days.filter((_, i) => i % 3 === 0 || i === days.length - 1)
        : days;
    const keys = dense.length ? dense : days;
    const buckets = new Map(
      keys.map((d) => [d, { bleu: 0, rouge: 0, missions: new Set<string>() }])
    );
    for (const row of gmRows) {
      const day = rowDay(row);
      const hit = buckets.has(day)
        ? day
        : keys.reduce((best, k) => (k <= day ? k : best), keys[0]);
      const prev = buckets.get(hit) ?? {
        bleu: 0,
        rouge: 0,
        missions: new Set<string>(),
      };
      if (row.color === "bleu") prev.bleu += row.amount;
      else prev.rouge += row.amount;
      prev.missions.add(row.batchId || row.id);
      buckets.set(hit, prev);
    }
    return [...buckets.entries()].map(([day, v]) => ({
      label: tickLabel(day),
      bleu: v.bleu,
      rouge: v.rouge,
      missions: v.missions.size,
    }));
  }, [from, to, gmRows]);

  const periodLabel =
    preset === "7"
      ? "7 derniers jours"
      : preset === "30"
        ? "30 derniers jours"
        : preset === "all"
          ? "depuis le début"
          : `${from} → ${to}`;

  const missionBatches = selected?.missions ?? 0;
  const avgGold =
    missionBatches > 0 && selected
      ? Math.round(selected.gold / missionBatches)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["7", "30", "all"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              preset === p
                ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                : "border-white/10 text-white/40 hover:text-white/70"
            )}
          >
            {p === "all" ? "Tout" : `${p} j`}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-[11px] text-white/40">
          Du
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPreset("custom");
              setFrom(e.target.value);
            }}
            className="rg-field py-1 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-white/40">
          au
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPreset("custom");
              setTo(e.target.value);
            }}
            className="rg-field py-1 text-xs"
          />
        </label>
        {selected ? (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="rg-btn"
              onClick={() =>
                void downloadGmStatsPng({
                  gmName: selected.cell.groupName,
                  periodLabel,
                  rows: gmRows,
                })
              }
            >
              <Download className="h-4 w-4" />
              Image
            </button>
            <button
              type="button"
              className="rg-btn"
              onClick={() =>
                downloadGmPeriodCsv(selected.cell.groupName, periodLabel, gmRows)
              }
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
          </div>
        ) : null}
      </div>

      {cellStats.length ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cellStats.map((item) => {
              const on = selected?.cell.id === item.cell.id;
              const faces = rankedMembers(item.cell, cells);
                  return (
                <div
                  key={item.cell.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPicked(item.cell.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPicked(item.cell.id);
                    }
                  }}
                  className={cn(
                    "rg-card rg-lift flex cursor-pointer items-center gap-3 p-3 text-left transition",
                    on
                      ? "border-violet-400/45 bg-violet-500/10 ring-1 ring-violet-400/35"
                      : "hover:border-white/15"
                  )}
                >
                  <span className="flex shrink-0 flex-nowrap items-center overflow-hidden">
                    {faces.length ? (
                      faces.map((m, i) => (
                        <RankFace
                          key={`${item.cell.id}-${m.cellRole}`}
                          member={m}
                          size={36}
                          link={false}
                          className={i ? "-ml-2" : undefined}
                        />
                      ))
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                        <Users className="h-4 w-4 text-white/50" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {item.cell.groupName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
                      <span>
                        {item.missions} mission{item.missions > 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <OrIcon
                          color={item.rouge > item.bleu ? "rouge" : "bleu"}
                          size={11}
                        />
                        {formatOrShort(item.gold)}
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {selected ? (
            <section className="rg-card relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-violet-500/16 via-sky-500/6 to-transparent"
              />
              <div className="relative space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.16em] text-white/35 uppercase">
                      {periodLabel}
                    </p>
                    <h2 className="mt-1 truncate text-xl font-medium text-white">
                      {selected.cell.groupName}
                    </h2>
                    <div
                      key={selected.cell.id}
                      className="mt-3 flex flex-nowrap items-center gap-2 overflow-hidden"
                    >
                      {rankedMembers(selected.cell, cells).map((m) => (
                        <RankFace
                          key={m.cellRole}
                          member={m}
                          size={44}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {memberStats.map(({ member, missions, gold }) => (
                        <p
                          key={member.cellRole}
                          className="text-[11px] text-white/45"
                        >
                          <span className="text-white/70">
                            {ROLE_RANK[member.cellRole]}. {member.displayName}
                          </span>
                          <span className="text-white/30">
                            {" "}
                            · {GM_CELL_ROLE_LABEL[member.cellRole]} · {missions}{" "}
                            miss. · {formatOrShort(gold)}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatBox
                    label="Missions"
                    value={String(missionBatches)}
                    hint={avgGold ? `${formatOrShort(avgGold)} / mission` : periodLabel}
                  />
                  <StatBox
                    label="Groupes"
                    value={String(groups.length)}
                    hint="missionnés"
                  />
                  <StatBox
                    label="Or bleu"
                    value={formatOrShort(gmRecap.bleu)}
                    hint={formatOr(gmRecap.bleu)}
                    tone="bleu"
                  />
                  <StatBox
                    label="Or rouge"
                    value={formatOrShort(gmRecap.rouge)}
                    hint={formatOr(gmRecap.rouge)}
                    tone="rouge"
                  />
                </div>

                <div className="h-40 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chart}
                      margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="gmFillBleu"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#38bdf8"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="100%"
                            stopColor="#38bdf8"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="gmFillRouge"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#fb7185"
                            stopOpacity={0.36}
                          />
                          <stop
                            offset="100%"
                            stopColor="#fb7185"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
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
                        strokeWidth={2}
                        fill="url(#gmFillBleu)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="rouge"
                        stroke="#fda4af"
                        strokeWidth={2}
                        fill="url(#gmFillRouge)"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="relative border-t border-white/[0.06]">
                <p className="px-5 pt-3 text-[10px] tracking-[0.16em] text-white/35 uppercase">
                  Groupes missionnés
                </p>
                {groups.length ? (
                  <ul className="max-h-[42vh] overflow-y-auto px-2 py-2">
                    {groups.map((g) => {
                      const catalog = findRpGroup(g.groupId);
                      const kind = catalog?.kind;
                      const color = kind
                        ? orColorForKind(kind)
                        : g.rouge > g.bleu
                          ? "rouge"
                          : "bleu";
                      return (
                        <li
                          key={g.groupId}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]"
                        >
                          <OrIcon color={color} size={16} />
                          <span className="min-w-0 flex-1 truncate text-sm text-white">
                            {g.groupName}
                          </span>
                          {kind ? (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px]",
                                GROUP_KIND_CHIP[kind]
                              )}
                            >
                              {GROUP_KIND_LABEL[kind]}
                            </span>
                          ) : null}
                          <span className="w-16 text-right text-[11px] text-white/40">
                            {g.count} miss.
                          </span>
                          <span className="w-16 text-right text-[12px] tabular-nums text-white/80">
                            {formatOrShort(g.bleu + g.rouge)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-white/40">
                    Aucun groupe sur cette période.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="rg-card px-4 py-10 text-center text-sm text-white/40">
          Aucun groupe GM recensé. Crée-les dans GameMasters.
        </p>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bleu" | "rouge";
}) {
  return (
    <div className="rg-inset px-3 py-2.5">
      <p className="text-[10px] tracking-wide text-white/40 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums text-white",
          tone === "bleu" && "text-sky-100",
          tone === "rouge" && "text-rose-100"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-white/35">{hint}</p> : null}
    </div>
  );
}
