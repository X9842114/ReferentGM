import type { RefgmAccount } from "@/lib/accounts";
import { getGradeDef } from "@/lib/grade-registry";
import type { GroupRewardEntry } from "@/lib/group-reward-log";
import {
  sumOrRewards,
  type StoredMission,
  type StoredMissionStatus,
} from "@/lib/mission-storage";
import {
  getGradeLabel,
  isGameMaster,
  isReferent,
} from "@/lib/permissions";
import type { RpGroupOption } from "@/lib/rp-groups";

export type StatsRange = "7d" | "30d" | "90d" | "all";

export const STATS_RANGE_OPTIONS: { id: StatsRange; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "90d", label: "90 jours" },
  { id: "all", label: "Tout" },
];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function labelDay(key: string) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function rangeStart(range: StatsRange, now = new Date()): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function inRange(iso: string | null | undefined, start: Date | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (!start) return true;
  return t >= start.getTime();
}

function buildDayKeys(range: StatsRange, now = new Date()): string[] {
  const end = startOfDay(now);
  if (range === "all") {
    // 30 derniers jours comme fenêtre d’affichage si « tout »
    const keys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      keys.push(dayKey(d));
    }
    return keys;
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

export type MissionTimelinePoint = {
  key: string;
  label: string;
  created: number;
  approved: number;
  rejected: number;
  pending: number;
  orBleu: number;
  orRouge: number;
  orTotal: number;
};

export type AccountTimelinePoint = {
  key: string;
  label: string;
  created: number;
  approved: number;
};

export type GradeSlice = {
  id: string;
  label: string;
  count: number;
  color: string;
};

export type StatusSlice = {
  id: StoredMissionStatus | "other";
  label: string;
  count: number;
  color: string;
};

export type GmLeaderboardRow = {
  name: string;
  missions: number;
  approved: number;
  pending: number;
  rejected: number;
  orTotal: number;
  orBleu: number;
  orRouge: number;
};

export type MissionRow = {
  id: string;
  title: string;
  author: string;
  status: StoredMissionStatus;
  statusLabel: string;
  createdAt: string;
  reviewedAt: string | null;
  orTotal: number;
  orBleu: number;
  orRouge: number;
};

export type GmGroupLeaderboardRow = {
  name: string;
  missions: number;
  approved: number;
  orTotal: number;
  orBleu: number;
  orRouge: number;
};

function resolveGroup(
  id: string,
  name: string,
  groups: RpGroupOption[]
): RpGroupOption | null {
  const byId = groups.find((g) => g.id === id);
  if (byId) return byId;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return groups.find((g) => g.name.toLowerCase() === n) ?? null;
}

export type RefgmAnalytics = {
  range: StatsRange;
  kpis: {
    accountsApproved: number;
    accountsPending: number;
    refs: number;
    gms: number;
    missionsTotal: number;
    suiviMissions: number;
    gmMissions: number;
    missionsPending: number;
    missionsApproved: number;
    missionsRejected: number;
    approvalRate: number;
    orSuiviTotal: number;
    orSuiviBleu: number;
    orSuiviRouge: number;
    orGmApprovedTotal: number;
    orGmApprovedBleu: number;
    orGmApprovedRouge: number;
    orGmPendingTotal: number;
    avgOrPerSuivi: number;
    catalogGroupsActive: number;
  };
  missionTimeline: MissionTimelinePoint[];
  accountTimeline: AccountTimelinePoint[];
  orCumulative: { key: string; label: string; bleu: number; rouge: number; total: number }[];
  gradeBreakdown: GradeSlice[];
  missionStatus: StatusSlice[];
  topGms: GmLeaderboardRow[];
  topGmGroups: GmGroupLeaderboardRow[];
  recentMissions: MissionRow[];
};

const STATUS_META: Record<
  StoredMissionStatus,
  { label: string; color: string }
> = {
  draft: { label: "Brouillon", color: "#64748b" },
  pending_review: { label: "À valider", color: "#a78bfa" },
  approved: { label: "Validée", color: "#34d399" },
  rejected: { label: "Refusée", color: "#fb7185" },
};

export function buildRefgmAnalytics(
  accounts: RefgmAccount[],
  missions: StoredMission[],
  range: StatsRange,
  extra?: { rewards?: GroupRewardEntry[]; groups?: RpGroupOption[] }
): RefgmAnalytics {
  const start = rangeStart(range);
  const dayKeys = buildDayKeys(range);

  const approvedAccounts = accounts.filter((a) => a.status === "APPROVED");
  const pendingAccounts = accounts.filter((a) => a.status === "PENDING");
  const refs = approvedAccounts.filter((a) => isReferent(a.grade));
  const gms = approvedAccounts.filter((a) => isGameMaster(a.grade));

  const missionsInWindow = missions.filter((m) =>
    inRange(m.createdAt, start)
  );

  const pendingMissions = missionsInWindow.filter(
    (m) => m.status === "pending_review"
  );
  const approvedMissions = missionsInWindow.filter(
    (m) => m.status === "approved"
  );
  const rejectedMissions = missionsInWindow.filter(
    (m) => m.status === "rejected"
  );
  const decided =
    approvedMissions.length + rejectedMissions.length;
  const approvalRate =
    decided === 0 ? 0 : Math.round((approvedMissions.length / decided) * 100);

  const rewards = extra?.rewards ?? [];
  const groups = extra?.groups ?? [];
  const rewardsInWindow = rewards.filter((r) =>
    inRange(r.missionDate ? `${r.missionDate}T12:00:00` : r.createdAt, start)
  );
  const suiviBatches = new Set(rewardsInWindow.map((r) => r.batchId));

  const orGmApproved = sumOrRewards(approvedMissions);
  const orGmPending = sumOrRewards(pendingMissions);
  let orSuiviBleu = 0;
  let orSuiviRouge = 0;
  for (const row of rewardsInWindow) {
    if (row.color === "bleu") orSuiviBleu += row.amount;
    else orSuiviRouge += row.amount;
  }
  const orSuiviTotal = orSuiviBleu + orSuiviRouge;

  const missionByDay = new Map<
    string,
    MissionTimelinePoint
  >();
  for (const key of dayKeys) {
    missionByDay.set(key, {
      key,
      label: labelDay(key),
      created: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      orBleu: 0,
      orRouge: 0,
      orTotal: 0,
    });
  }

  for (const mission of missions) {
    const createdKey = dayKey(startOfDay(new Date(mission.createdAt)));
    const createdPoint = missionByDay.get(createdKey);
    if (createdPoint) {
      createdPoint.created += 1;
      if (mission.status === "pending_review") createdPoint.pending += 1;
    }

    const reviewIso = mission.reviewedAt ?? mission.updatedAt;
    if (mission.status === "approved" || mission.status === "rejected") {
      const reviewKey = dayKey(startOfDay(new Date(reviewIso)));
      const reviewPoint = missionByDay.get(reviewKey);
      if (reviewPoint) {
        if (mission.status === "approved") {
          reviewPoint.approved += 1;
          const or = sumOrRewards([mission]);
          reviewPoint.orBleu += or.bleu;
          reviewPoint.orRouge += or.rouge;
          reviewPoint.orTotal += or.total;
        } else {
          reviewPoint.rejected += 1;
        }
      }
    }
  }

  const seenSuiviBatch = new Set<string>();
  for (const row of rewardsInWindow) {
    const when = row.missionDate
      ? `${row.missionDate}T12:00:00`
      : row.createdAt;
    const createdKey = dayKey(startOfDay(new Date(when)));
    const point = missionByDay.get(createdKey);
    if (!point) continue;
    const stamp = `${createdKey}:${row.batchId || row.id}`;
    if (!seenSuiviBatch.has(stamp)) {
      seenSuiviBatch.add(stamp);
      point.created += 1;
      point.approved += 1;
    }
    if (row.color === "bleu") point.orBleu += row.amount;
    else point.orRouge += row.amount;
    point.orTotal += row.amount;
  }

  const missionTimeline = dayKeys.map(
    (key) => missionByDay.get(key)!
  );

  let cumBleu = 0;
  let cumRouge = 0;
  const orCumulative = missionTimeline.map((point) => {
    cumBleu += point.orBleu;
    cumRouge += point.orRouge;
    return {
      key: point.key,
      label: point.label,
      bleu: cumBleu,
      rouge: cumRouge,
      total: cumBleu + cumRouge,
    };
  });

  const accountByDay = new Map<string, AccountTimelinePoint>();
  for (const key of dayKeys) {
    accountByDay.set(key, {
      key,
      label: labelDay(key),
      created: 0,
      approved: 0,
    });
  }
  for (const account of accounts) {
    const createdKey = dayKey(startOfDay(new Date(account.createdAt)));
    const point = accountByDay.get(createdKey);
    if (point) point.created += 1;
    if (account.status === "APPROVED" && account.reviewedAt) {
      const approvedKey = dayKey(startOfDay(new Date(account.reviewedAt)));
      const ap = accountByDay.get(approvedKey);
      if (ap) ap.approved += 1;
    }
  }
  const accountTimeline = dayKeys.map((key) => accountByDay.get(key)!);

  const gradeBreakdown = Object.entries(
    approvedAccounts.reduce<Record<string, number>>((acc, account) => {
      acc[account.grade] = (acc[account.grade] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([id, count]) => ({
      id,
      count,
      label: getGradeLabel(id),
      color: getGradeDef(id).color,
    }))
    .sort((a, b) => b.count - a.count);

  const statusCounts: Record<StoredMissionStatus, number> = {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
  };
  for (const mission of missionsInWindow) {
    statusCounts[mission.status] += 1;
  }
  const missionStatus: StatusSlice[] = (
    Object.keys(statusCounts) as StoredMissionStatus[]
  )
    .map((id) => ({
      id,
      label: STATUS_META[id].label,
      count: statusCounts[id],
      color: STATUS_META[id].color,
    }))
    .filter((s) => s.count > 0);

  const gmMap = new Map<string, GmLeaderboardRow>();
  for (const mission of missionsInWindow) {
    if (mission.status === "draft") continue;
    const name = mission.authorName?.trim() || "Inconnu";
    const row =
      gmMap.get(name) ??
      ({
        name,
        missions: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        orTotal: 0,
        orBleu: 0,
        orRouge: 0,
      } satisfies GmLeaderboardRow);
    row.missions += 1;
    if (mission.status === "approved") {
      row.approved += 1;
      const or = sumOrRewards([mission]);
      row.orBleu += or.bleu;
      row.orRouge += or.rouge;
      row.orTotal += or.total;
    } else if (mission.status === "pending_review") {
      row.pending += 1;
    } else if (mission.status === "rejected") {
      row.rejected += 1;
    }
    gmMap.set(name, row);
  }
  const gmBatches = new Map<string, Set<string>>();
  for (const row of rewardsInWindow) {
    const name = row.gmName.trim() || "Inconnu";
    const gm =
      gmMap.get(name) ??
      ({
        name,
        missions: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        orTotal: 0,
        orBleu: 0,
        orRouge: 0,
      } satisfies GmLeaderboardRow);
    const batches = gmBatches.get(name) ?? new Set<string>();
    batches.add(row.batchId || row.id);
    gmBatches.set(name, batches);
    gm.missions = batches.size;
    gm.approved = batches.size;
    if (row.color === "bleu") gm.orBleu += row.amount;
    else gm.orRouge += row.amount;
    gm.orTotal += row.amount;
    gmMap.set(name, gm);
  }
  const topGms = Array.from(gmMap.values()).sort(
    (a, b) => b.missions - a.missions || b.orTotal - a.orTotal
  );

  const groupMap = new Map<string, GmGroupLeaderboardRow>();
  for (const mission of missionsInWindow) {
    const catalog = resolveGroup(
      mission.authorGroupId ?? "",
      mission.authorGroupName ?? "",
      groups
    );
    const name =
      catalog?.name ||
      mission.authorGroupName?.trim() ||
      (mission.authorGroupId ? `Groupe ${mission.authorGroupId.slice(0, 6)}` : "");
    if (!name) continue;
    const key = catalog?.id || name;
    const row =
      groupMap.get(key) ??
      ({
        name,
        missions: 0,
        approved: 0,
        orTotal: 0,
        orBleu: 0,
        orRouge: 0,
      } satisfies GmGroupLeaderboardRow);
    row.missions += 1;
    if (mission.status === "approved") {
      row.approved += 1;
      const or = sumOrRewards([mission]);
      row.orBleu += or.bleu;
      row.orRouge += or.rouge;
      row.orTotal += or.total;
    }
    groupMap.set(key, row);
  }
  const groupBatches = new Map<string, Set<string>>();
  for (const row of rewardsInWindow) {
    const catalog = resolveGroup(row.groupId, row.groupName, groups);
    const name = catalog?.name || row.groupName || row.groupId;
    if (!name) continue;
    const key = catalog?.id || name;
    const rec =
      groupMap.get(key) ??
      ({
        name,
        missions: 0,
        approved: 0,
        orTotal: 0,
        orBleu: 0,
        orRouge: 0,
      } satisfies GmGroupLeaderboardRow);
    rec.name = name;
    const batches = groupBatches.get(key) ?? new Set<string>();
    batches.add(row.batchId || row.id);
    groupBatches.set(key, batches);
    rec.missions = batches.size;
    rec.approved = batches.size;
    if (row.color === "bleu") rec.orBleu += row.amount;
    else rec.orRouge += row.amount;
    rec.orTotal += row.amount;
    groupMap.set(key, rec);
  }
  const topGmGroups = Array.from(groupMap.values()).sort(
    (a, b) => b.missions - a.missions || b.orTotal - a.orTotal
  );

  const suiviRecent: MissionRow[] = [...rewardsInWindow]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 12)
    .map((row) => {
      const catalog = resolveGroup(row.groupId, row.groupName, groups);
      return {
        id: row.id,
        title: row.missionTitle || "Mission suivi",
        author: row.loggedByName?.trim() || row.gmName || "·",
        status: "approved" as const,
        statusLabel: "Suivi",
        createdAt: row.createdAt,
        reviewedAt: row.createdAt,
        orTotal: row.amount,
        orBleu: row.color === "bleu" ? row.amount : 0,
        orRouge: row.color === "rouge" ? row.amount : 0,
      };
    });

  const proposalRecent: MissionRow[] = [...missionsInWindow]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 12)
    .map((mission) => {
      const or = sumOrRewards([mission]);
      const catalog = resolveGroup(
        mission.authorGroupId ?? "",
        mission.authorGroupName ?? "",
        groups
      );
      const author =
        catalog?.name ||
        mission.authorGroupName?.trim() ||
        mission.authorName?.trim() ||
        "·";
      return {
        id: mission.id,
        title: mission.title || "Sans titre",
        author,
        status: mission.status,
        statusLabel: STATUS_META[mission.status].label,
        createdAt: mission.createdAt,
        reviewedAt: mission.reviewedAt ?? null,
        orTotal: or.total,
        orBleu: or.bleu,
        orRouge: or.rouge,
      };
    });

  const recentMissions = [...suiviRecent, ...proposalRecent]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 12);

  const catalogActive = new Set(
    [...groupMap.keys()].filter((id) => groups.some((g) => g.id === id))
  );

  return {
    range,
    kpis: {
      accountsApproved: approvedAccounts.length,
      accountsPending: pendingAccounts.length,
      refs: refs.length,
      gms: gms.length,
      missionsTotal: suiviBatches.size + missionsInWindow.length,
      suiviMissions: suiviBatches.size,
      gmMissions: missionsInWindow.length,
      missionsPending: pendingMissions.length,
      missionsApproved: approvedMissions.length,
      missionsRejected: rejectedMissions.length,
      approvalRate,
      orSuiviTotal,
      orSuiviBleu,
      orSuiviRouge,
      orGmApprovedTotal: orGmApproved.total,
      orGmApprovedBleu: orGmApproved.bleu,
      orGmApprovedRouge: orGmApproved.rouge,
      orGmPendingTotal: orGmPending.total,
      avgOrPerSuivi:
        suiviBatches.size === 0
          ? 0
          : Math.round(orSuiviTotal / suiviBatches.size),
      catalogGroupsActive: catalogActive.size || topGmGroups.length,
    },
    missionTimeline,
    accountTimeline,
    orCumulative,
    gradeBreakdown,
    missionStatus,
    topGms,
    topGmGroups,
    recentMissions,
  };
}
