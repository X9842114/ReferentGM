"use client";

import { useAccount } from "@/components/account-context";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import {
  buildRefgmAnalytics,
  STATS_RANGE_OPTIONS,
  type StatsRange,
} from "@/lib/refgm-analytics";
import { downloadAnalyticsCsv } from "@/lib/csv-export";
import {
  downloadGroupRewardsPng,
  listGroupRewards,
  recapGroupRewards,
  type GroupRewardEntry,
} from "@/lib/group-reward-log";
import { listMissions, type StoredMission } from "@/lib/mission-storage";
import { listRpGroups, type RpGroupOption } from "@/lib/rp-groups";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { getGradeLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Coins,
  Download,
  FileSpreadsheet,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  background: "#111113",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-white/30" />
      </div>
      <p className="text-xl font-medium tabular-nums text-white/95">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/35">{hint}</p>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5",
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-sm font-medium text-white/90">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-white/35">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatisticsPanel() {
  const { grade } = useAccount();
  const [range, setRange] = useState<StatsRange>("30d");
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);
  const [missions, setMissions] = useState<StoredMission[]>([]);
  const [rewards, setRewards] = useState<GroupRewardEntry[]>([]);
  const [groups, setGroups] = useState<RpGroupOption[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refreshAccounts = () => {
      void listAllAccounts().then((list) => {
        setAccounts(list);
        setReady(true);
      });
    };
    const refreshMissions = () => setMissions(listMissions());
    const refreshLive = () => {
      setRewards(listGroupRewards());
      setGroups(listRpGroups());
    };

    refreshAccounts();
    refreshMissions();
    refreshLive();
    window.addEventListener("refgm:accounts-updated", refreshAccounts);
    window.addEventListener("refgm:missions-updated", refreshMissions);
    window.addEventListener("refgm:group-rewards-updated", refreshLive);
    window.addEventListener("refgm:rp-groups-updated", refreshLive);
    window.addEventListener("storage", refreshMissions);
    window.addEventListener("storage", refreshLive);
    return () => {
      window.removeEventListener("refgm:accounts-updated", refreshAccounts);
      window.removeEventListener("refgm:missions-updated", refreshMissions);
      window.removeEventListener("refgm:group-rewards-updated", refreshLive);
      window.removeEventListener("refgm:rp-groups-updated", refreshLive);
      window.removeEventListener("storage", refreshMissions);
      window.removeEventListener("storage", refreshLive);
    };
  }, []);

  const analytics = useMemo(
    () => buildRefgmAnalytics(accounts, missions, range, { rewards, groups }),
    [accounts, missions, range, rewards, groups]
  );

  const emptyMissions = analytics.missionTimeline.every(
    (p) => p.created === 0 && p.approved === 0 && p.rejected === 0
  );

  const rangeLabel =
    STATS_RANGE_OPTIONS.find((o) => o.id === range)?.label ?? range;
  const rewardsInRange = useMemo(() => {
    if (range === "all") return rewards;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return rewards.filter((row) => {
      const t = new Date(row.createdAt).getTime();
      return !Number.isNaN(t) && t >= start.getTime();
    });
  }, [rewards, range]);
  const spark = analytics.orCumulative.map((d) => d.total ?? d.bleu + d.rouge);

  return (
    <StaffPageShell
      title="Statistiques"
      description={`Suivi groupes et file GM, séparés. ${getGradeLabel(grade)}.`}
      className="max-w-6xl"
      ready={ready}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/30 p-1">
            {STATS_RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs transition-colors",
                  range === option.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rg-btn"
            onClick={() =>
              void downloadGroupRewardsPng(
                recapGroupRewards(rewardsInRange),
                `Statistiques · ${rangeLabel}`,
                "statistiques-refgm.png",
                spark
              )
            }
          >
            <Download className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            className="rg-btn"
            onClick={() =>
              downloadAnalyticsCsv({
                rangeLabel,
                kpis: analytics.kpis as Record<string, string | number>,
                missionTimeline: analytics.missionTimeline,
                orCumulative: analytics.orCumulative,
                topGms: analytics.topGms,
                topGmGroups: analytics.topGmGroups,
                rewards: rewardsInRange,
              })
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </button>
        </div>
      }
    >
        {!ready ? (
          <p className="text-sm text-white/35">Chargement des données…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi
                label="Missions suivi"
                value={analytics.kpis.suiviMissions}
                hint="Notées depuis l’accueil"
                icon={Activity}
              />
              <Kpi
                label="Or donné"
                value={analytics.kpis.orSuiviTotal}
                hint={`${analytics.kpis.orSuiviBleu} bleu · ${analytics.kpis.orSuiviRouge} rouge`}
                icon={Coins}
              />
              <Kpi
                label="File GM"
                value={analytics.kpis.missionsPending}
                hint={`${analytics.kpis.gmMissions} propositions · ${analytics.kpis.approvalRate}% validées`}
                icon={Percent}
              />
              <Kpi
                label="Or file GM"
                value={analytics.kpis.orGmApprovedTotal}
                hint={
                  analytics.kpis.orGmPendingTotal
                    ? `${analytics.kpis.orGmPendingTotal} encore en attente`
                    : `${analytics.kpis.orGmApprovedBleu} bleu · ${analytics.kpis.orGmApprovedRouge} rouge`
                }
                icon={TrendingUp}
              />
              <Kpi
                label="Groupes catalogue"
                value={analytics.kpis.catalogGroupsActive}
                hint="Avec au moins une mission suivi ou GM"
                icon={Users}
              />
              <Kpi
                label="Équipe"
                value={analytics.kpis.accountsApproved}
                hint={`${analytics.kpis.refs} réf. · ${analytics.kpis.gms} GM`}
                icon={Users}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                title="Activité missions"
                hint="Suivi noté + propositions GM (validées / refusées)"
                className="lg:col-span-3"
              >
                <div className="h-72 w-full">
                  {emptyMissions ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      Pas encore assez de données sur cette période
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.missionTimeline}>
                        <defs>
                          <linearGradient id="stat-created" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="stat-approved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="created"
                          name="Créées"
                          stroke="#a78bfa"
                          fill="url(#stat-created)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="approved"
                          name="Validées"
                          stroke="#34d399"
                          fill="url(#stat-approved)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="rejected"
                          name="Refusées"
                          stroke="#fb7185"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Statuts missions"
                hint="Répartition sur la période"
                className="lg:col-span-2"
              >
                <div className="h-72 w-full">
                  {analytics.missionStatus.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      Aucune mission
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.missionStatus}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                          stroke="rgba(10,10,11,0.8)"
                        >
                          {analytics.missionStatus.map((slice) => (
                            <Cell key={slice.id} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend
                          wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Or cumulé"
                hint="Bleu (PF) / rouge (Gang · Orga) : suivi + file GM"
              >
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.orCumulative}>
                      <defs>
                        <linearGradient id="or-bleu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="or-rouge" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="bleu"
                        name="Or bleu"
                        stroke="#60a5fa"
                        fill="url(#or-bleu)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="rouge"
                        name="Or rouge"
                        stroke="#f87171"
                        fill="url(#or-rouge)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/40">
                  <span>
                    Moy. / mission suivi :{" "}
                    <span className="text-white/70">
                      {analytics.kpis.avgOrPerSuivi}
                    </span>
                  </span>
                  <span>
                    Or file GM en attente :{" "}
                    <span className="text-amber-200/80">
                      {analytics.kpis.orGmPendingTotal}
                    </span>
                  </span>
                </div>
              </ChartCard>

              <ChartCard
                title="Comptes"
                hint="Nouveaux comptes et validations journalières"
              >
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.accountTimeline}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="created"
                        name="Inscriptions"
                        stroke="#fbbf24"
                        strokeWidth={2.25}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="approved"
                        name="Validés"
                        stroke="#34d399"
                        strokeWidth={2.25}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {analytics.kpis.accountsPending > 0 ? (
                  <p className="mt-3 text-[11px] text-amber-200/70">
                    {analytics.kpis.accountsPending} compte
                    {analytics.kpis.accountsPending > 1 ? "s" : ""} encore en
                    attente de validation
                  </p>
                ) : null}
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                title="Top GameMasters"
                hint="File GM + missions où ils sont notés au suivi"
                className="lg:col-span-3"
              >
                <div className="h-72 w-full">
                  {analytics.topGms.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      Aucun GM actif sur la période
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.topGms}
                        layout="vertical"
                        margin={{ left: 8, right: 12 }}
                      >
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={88}
                          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend
                          wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                        />
                        <Bar
                          dataKey="missions"
                          name="Missions"
                          fill="#a78bfa"
                          radius={[0, 6, 6, 0]}
                          barSize={12}
                        />
                        <Bar
                          dataKey="orTotal"
                          name="Or"
                          fill="#fbbf24"
                          radius={[0, 6, 6, 0]}
                          barSize={12}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Répartition grades"
                hint="Comptes approuvés"
                className="lg:col-span-2"
              >
                <div className="h-72 w-full">
                  {analytics.gradeBreakdown.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      Aucun compte
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.gradeBreakdown}>
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.06)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" name="Comptes" radius={[6, 6, 0, 0]}>
                          {analytics.gradeBreakdown.map((slice) => (
                            <Cell key={slice.id} fill={slice.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>
            </div>

            <ChartCard
              title="Détail missions"
              hint="Dernières mises à jour sur la période sélectionnée"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] tracking-wide text-white/35 uppercase">
                      <th className="pb-2 pr-3 font-medium">Mission</th>
                      <th className="pb-2 pr-3 font-medium">Auteur</th>
                      <th className="pb-2 pr-3 font-medium">Statut</th>
                      <th className="pb-2 pr-3 font-medium">Or</th>
                      <th className="pb-2 font-medium">MAJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentMissions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-sm text-white/35"
                        >
                          Aucune mission à afficher
                        </td>
                      </tr>
                    ) : (
                      analytics.recentMissions.map((row, index) => (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-b border-white/[0.04]"
                        >
                          <td className="max-w-[220px] truncate py-3 pr-3 text-white/85">
                            {row.title}
                          </td>
                          <td className="py-3 pr-3 text-white/50">{row.author}</td>
                          <td className="py-3 pr-3">
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-[11px]",
                                row.status === "approved" &&
                                  "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
                                row.status === "pending_review" &&
                                  "border-violet-400/25 bg-violet-500/10 text-violet-100",
                                row.status === "rejected" &&
                                  "border-rose-400/25 bg-rose-500/10 text-rose-100",
                                row.status === "draft" &&
                                  "border-white/10 bg-white/[0.04] text-white/50"
                              )}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="py-3 pr-3 tabular-nums text-white/55">
                            {row.orTotal}
                            <span className="ml-1 text-[10px] text-white/30">
                              ({row.orBleu}B/{row.orRouge}R)
                            </span>
                          </td>
                          <td className="py-3 text-[11px] text-white/35">
                            {formatDate(row.reviewedAt ?? row.createdAt)}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            {analytics.topGmGroups.length > 0 ? (
              <ChartCard
                title="Groupes"
                hint="Catalogue live + suivi + propositions"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] tracking-wide text-white/35 uppercase">
                        <th className="pb-2 pr-3 font-medium">#</th>
                        <th className="pb-2 pr-3 font-medium">Groupe</th>
                        <th className="pb-2 pr-3 font-medium">Missions</th>
                        <th className="pb-2 pr-3 font-medium">Validées</th>
                        <th className="pb-2 font-medium">Or (B / R)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topGmGroups.map((row, index) => (
                        <tr
                          key={row.name}
                          className="border-b border-white/[0.04]"
                        >
                          <td className="py-2.5 pr-3 text-white/35">
                            {index + 1}
                          </td>
                          <td className="py-2.5 pr-3 text-white/85">{row.name}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-white/60">
                            {row.missions}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-emerald-200/80">
                            {row.approved}
                          </td>
                          <td className="py-2.5 tabular-nums text-white/60">
                            {row.orBleu}B / {row.orRouge}R
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            ) : null}

            {analytics.topGms.length > 0 ? (
              <ChartCard title="Classement GM (données)" hint="Missions et Or détaillés">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] tracking-wide text-white/35 uppercase">
                        <th className="pb-2 pr-3 font-medium">#</th>
                        <th className="pb-2 pr-3 font-medium">GM</th>
                        <th className="pb-2 pr-3 font-medium">Missions</th>
                        <th className="pb-2 pr-3 font-medium">Validées</th>
                        <th className="pb-2 pr-3 font-medium">Attente</th>
                        <th className="pb-2 font-medium">Or</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topGms.map((row, index) => (
                        <tr
                          key={row.name}
                          className="border-b border-white/[0.04]"
                        >
                          <td className="py-2.5 pr-3 text-white/35">{index + 1}</td>
                          <td className="py-2.5 pr-3 text-white/85">{row.name}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-white/60">
                            {row.missions}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-emerald-200/80">
                            {row.approved}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-amber-200/70">
                            {row.pending}
                          </td>
                          <td className="py-2.5 tabular-nums text-white/60">
                            {row.orTotal}
                            <span className="ml-1 text-[10px] text-white/30">
                              {row.orBleu}B / {row.orRouge}R
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            ) : null}

            <p className="flex items-center gap-2 text-[11px] text-white/30">
              <BarChart3 className="h-3.5 w-3.5" />
              <TrendingUp className="h-3.5 w-3.5" />
              Données live comptes et activité RefGM
            </p>
          </>
        )}
    </StaffPageShell>
  );
}
