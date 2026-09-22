import { kvRead, kvWrite } from "@/lib/app-kv";
import {
  parseDiscordMissionPaste,
  type ParsedDiscordMission,
} from "@/lib/discord-mission-parse";
import { notifyReferentStaff } from "@/lib/notifications";
import {
  estimateOrFromDuration,
  orColorForKind,
  orColorLabel,
  type OrColor,
} from "@/lib/or-rewards";

export type MissionFollowUpGrant = {
  groupId: string;
  groupName: string;
  color: OrColor;
  amount: number;
};

export type MissionFollowUp = {
  rewardedBy: string;
  rewardedByName: string;
  rewardedAt: string;
  grants: MissionFollowUpGrant[];
  suiviMessage: string;
};

export type CataloguedDiscordMission = ParsedDiscordMission & {
  id: string;
  raw: string;
  importedBy: string;
  importedByName: string;
  createdAt: string;
  followUp?: MissionFollowUp | null;
};

export type MissionBoardFilter = "all" | "ouverte" | "recompensee";

const KEY = "refgm.discord-missions.v1";

function readAll(): CataloguedDiscordMission[] {
  const parsed = kvRead<CataloguedDiscordMission[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(rows: CataloguedDiscordMission[]) {
  kvWrite(KEY, rows.slice(0, 400), "refgm:discord-missions-updated");
}

export function listCataloguedDiscordMissions(): CataloguedDiscordMission[] {
  return [...readAll()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function isMissionRewarded(row: CataloguedDiscordMission) {
  return Boolean(row.followUp?.rewardedAt);
}

export function suggestedGrants(
  row: Pick<CataloguedDiscordMission, "groups" | "duration">
): MissionFollowUpGrant[] {
  const amount = estimateOrFromDuration(row.duration);
  return row.groups.map((group) => ({
    groupId: group.id,
    groupName: group.name,
    color: orColorForKind(group.kind),
    amount,
  }));
}

export function buildSuiviMessage(input: {
  title: string;
  duration: string;
  rewards: string;
  gmNames: string[];
  referentName: string;
  grants: MissionFollowUpGrant[];
}) {
  const groups =
    input.grants.length > 0
      ? input.grants
          .map(
            (g) =>
              `${g.groupName} : ${g.amount} ${orColorLabel(g.color)}`
          )
          .join("\n")
      : "Aucun groupe lié";
  return [
    `📌 Suivi mission`,
    `Mission : ${input.title.trim() || "Sans titre"}`,
    input.duration ? `Durée : ${input.duration}` : null,
    input.rewards ? `Récompenses collées : ${input.rewards}` : null,
    `Groupes / Or donné :`,
    groups,
    input.gmNames.length ? `GM : ${input.gmNames.join(", ")}` : null,
    `Référent : ${input.referentName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function saveCataloguedDiscordMission(input: {
  raw: string;
  importedBy: string;
  importedByName: string;
  parsed?: ParsedDiscordMission;
}): CataloguedDiscordMission | null {
  const parsed = input.parsed ?? parseDiscordMissionPaste(input.raw);
  if (!parsed.title && !parsed.description) return null;
  const row: CataloguedDiscordMission = {
    ...parsed,
    id: crypto.randomUUID(),
    raw: input.raw.trim(),
    importedBy: input.importedBy,
    importedByName: input.importedByName.trim() || "Référent",
    createdAt: new Date().toISOString(),
    followUp: null,
  };
  writeAll([row, ...readAll()]);
  void notifyReferentStaff({
    type: "proposition.nouvelle",
    title: "Nouvelle mission Discord",
    body: `${row.title || "Sans titre"} · ${row.importedByName}`,
    href: "/dashboard/suivi-groupes",
    excludeUserId: input.importedBy,
  });
  return row;
}

export function recordMissionFollowUp(input: {
  id: string;
  rewardedBy: string;
  rewardedByName: string;
  grants: MissionFollowUpGrant[];
  suiviMessage: string;
}): CataloguedDiscordMission | null {
  const all = readAll();
  const idx = all.findIndex((row) => row.id === input.id);
  if (idx < 0) return null;
  const followUp: MissionFollowUp = {
    rewardedBy: input.rewardedBy,
    rewardedByName: input.rewardedByName.trim() || "Référent",
    rewardedAt: new Date().toISOString(),
    grants: input.grants.filter((g) => g.amount > 0),
    suiviMessage: input.suiviMessage.trim(),
  };
  const next = { ...all[idx], followUp };
  all[idx] = next;
  writeAll(all);
  void notifyReferentStaff({
    type: "proposition.suivi",
    title: "Récompenses + suivi mission",
    body: `${next.title || "Sans titre"} · ${followUp.rewardedByName}`,
    href: "/dashboard/suivi-groupes",
    excludeUserId: input.rewardedBy,
  });
  return next;
}

export function deleteCataloguedDiscordMission(id: string) {
  writeAll(readAll().filter((row) => row.id !== id));
}
