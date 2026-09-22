import { type RefgmAccount } from "@/lib/accounts";
import {
  isMissionRewarded,
  listCataloguedDiscordMissions,
} from "@/lib/discord-mission-catalog";
import { listGroupRewards } from "@/lib/group-reward-log";
import { normalizeGrade } from "@/lib/grades";
import { listMissions } from "@/lib/mission-storage";
import {
  getGradeLabel,
  isDeveloper,
  isGameMaster,
  isReferent,
} from "@/lib/permissions";
import { listPlanningSlots } from "@/lib/referent-planning";
import { listActivity } from "@/lib/staff-storage";

export type StaffActivityLevel = "active" | "ok" | "low" | "inactive";

export type StaffActivityRow = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  grade: string;
  gradeLabel: string;
  kind: "REFERENT" | "GAMEMASTER" | "DEV";
  kindLabel: string;
  missionsProposed: number;
  missionsApproved: number;
  discordMissions: number;
  discordImported: number;
  suiviCount: number;
  orLogged: number;
  planningOpen: number;
  planningTotal: number;
  lastActiveAt: string | null;
  daysSinceActive: number | null;
  level: StaffActivityLevel;
  improvements: string[];
};

function daysBetween(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Activité = travail QG réel, pas une MAJ de compte. */
function levelFrom(signals: number, days: number | null): StaffActivityLevel {
  if (signals === 0) return "inactive";
  if (days != null && days >= 14) return "low";
  if (signals >= 4 || (days != null && days <= 7)) return "active";
  return "ok";
}

function kindOf(account: RefgmAccount): StaffActivityRow["kind"] | null {
  const g = normalizeGrade(account.grade);
  if (isDeveloper(g)) return "DEV";
  if (isGameMaster(g)) return "GAMEMASTER";
  if (isReferent(g)) return "REFERENT";
  return null;
}

function kindLabel(kind: StaffActivityRow["kind"]) {
  if (kind === "GAMEMASTER") return "GameMaster";
  if (kind === "DEV") return "Développeur";
  return "Référent";
}

function normName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function samePerson(
  account: RefgmAccount,
  id?: string | null,
  name?: string | null
) {
  if (id && id === account.userId) return true;
  const a = normName(account.displayName);
  const b = normName(name);
  return Boolean(a && b && a === b);
}

export function buildStaffActivityReport(
  accounts: RefgmAccount[]
): StaffActivityRow[] {
  const missions = listMissions();
  const activities = listActivity();
  const rewards = listGroupRewards();
  const planning = listPlanningSlots();
  const discord = listCataloguedDiscordMissions();

  return accounts
    .filter((a) => a.status === "APPROVED")
    .map((account) => {
      const kind = kindOf(account);
      if (!kind) return null;

      const proposed = missions.filter((m) =>
        samePerson(account, m.authorId, m.authorName)
      );
      const discordAsGm = discord.filter((row) =>
        row.gmNames.some((name) => samePerson(account, null, name))
      );
      const discordImported = discord.filter((row) =>
        samePerson(account, row.importedBy, row.importedByName)
      );
      const suiviLogged = rewards.filter((r) =>
        samePerson(account, r.loggedBy, r.loggedByName)
      );
      const suiviAsGm = rewards.filter((r) =>
        samePerson(account, r.gmUserId, r.gmName)
      );
      const discordFollowUps = discord.filter((row) =>
        samePerson(
          account,
          row.followUp?.rewardedBy,
          row.followUp?.rewardedByName
        )
      );
      const planHits = planning.filter(
        (slot) =>
          slot.userId === account.userId ||
          slot.createdBy === account.userId ||
          slot.assignedById === account.userId ||
          slot.assignees.some((mate) => mate.userId === account.userId)
      );
      const logs = activities.filter((a) => a.actorId === account.userId);

      const stamps = [
        ...proposed.map((m) => m.updatedAt),
        ...discordAsGm.map((m) => m.createdAt),
        ...discordImported.map((m) => m.createdAt),
        ...discordFollowUps.map((m) => m.followUp?.rewardedAt ?? m.createdAt),
        ...suiviLogged.map((r) => r.createdAt),
        ...suiviAsGm.map((r) => r.createdAt),
        ...planHits.map((s) => s.createdAt),
        ...logs.map((l) => l.createdAt),
      ].filter(Boolean);
      const lastActiveAt = stamps.length
        ? stamps.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          )[0]!
        : null;
      const daysSinceActive = daysBetween(lastActiveAt);

      const suiviCount =
        kind === "GAMEMASTER"
          ? suiviAsGm.length + discordAsGm.length
          : suiviLogged.length + discordFollowUps.length;

      const signals =
        proposed.length +
        discordAsGm.length +
        discordImported.length +
        Math.min(suiviLogged.length + suiviAsGm.length, 12) +
        Math.min(planHits.length, 8);

      const level = levelFrom(signals, daysSinceActive);
      const improvements: string[] = [];

      if (kind === "REFERENT") {
        if (suiviLogged.length === 0 && planHits.length === 0) {
          improvements.push("Aucun suivi ni planning à son nom");
        } else if (suiviLogged.length === 0) {
          improvements.push("Planning OK, mais aucun or / suivi enregistré");
        }
        if (level === "inactive" || level === "low") {
          improvements.push("Peu d’activité ces derniers jours");
        }
      }

      if (kind === "GAMEMASTER") {
        if (discordAsGm.length === 0 && proposed.length === 0) {
          improvements.push("Aucune mission Discord ni mission notée");
        }
        if (level === "inactive" || level === "low") {
          improvements.push("Peu visible ces derniers jours");
        }
      }

      const grade = normalizeGrade(account.grade);
      return {
        userId: account.userId,
        displayName: account.displayName,
        avatarUrl: account.discordAvatarUrl,
        grade,
        gradeLabel: getGradeLabel(grade),
        kind,
        kindLabel: kindLabel(kind),
        missionsProposed: proposed.length,
        missionsApproved: proposed.filter((m) => m.status === "approved")
          .length,
        discordMissions: discordAsGm.length,
        discordImported: discordImported.length,
        suiviCount,
        orLogged: suiviLogged.reduce((sum, r) => sum + (r.amount || 0), 0),
        planningOpen: planHits.filter((s) => s.status === "open").length,
        planningTotal: planHits.length,
        lastActiveAt,
        daysSinceActive,
        level,
        improvements,
      } satisfies StaffActivityRow;
    })
    .filter((row): row is StaffActivityRow => Boolean(row))
    .sort((a, b) => {
      const order = { inactive: 0, low: 1, ok: 2, active: 3 };
      return order[a.level] - order[b.level];
    });
}

export function countUnrewardedDiscordMissions() {
  return listCataloguedDiscordMissions().filter((row) => !isMissionRewarded(row))
    .length;
}

export function activityLevelLabel(level: StaffActivityLevel) {
  switch (level) {
    case "active":
      return "Actif";
    case "ok":
      return "En rythme";
    case "low":
      return "Faible";
    case "inactive":
      return "Inactif";
  }
}
