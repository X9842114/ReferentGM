import { listCataloguedDiscordMissions } from "@/lib/discord-mission-catalog";
import { listGroupRewards, type GroupRewardEntry } from "@/lib/group-reward-log";
import type { GmCell, GmCellMember, GmCellStats } from "@/lib/gm-cells";
import { getGmCell, listGmCells } from "@/lib/gm-cells";
import {
  memberIdentityKeys,
  rowIdentityKeys,
  uniqueMembers,
  uniquePeople,
  usefulMemberName,
} from "@/lib/gm-cell-identity";
import { listMissions } from "@/lib/mission-storage";
import { orColorLabel } from "@/lib/or-rewards";
import { resolveRpGroup } from "@/lib/rp-groups";

export type GmActivityItem = {
  id: string;
  title: string;
  when: string;
  detail: string;
  kind: "mission" | "suivi";
  memberIds: string[];
  orRouge: number;
  orBleu: number;
};

function fold(value: string) {
  return value.trim().toLowerCase();
}

function foldName(value: string) {
  return fold(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

type OwnerHit = { cellId: string; member: GmCellMember; via: "id" | "name" };

function indexCells(cells: GmCell[]) {
  const byKey = new Map<string, OwnerHit[]>();
  for (const cell of cells) {
    for (const member of uniqueMembers(cell.members)) {
      const keys = memberIdentityKeys(member);
      for (const key of keys) {
        const via = key.startsWith("n:") ? "name" : "id";
        const list = byKey.get(key) ?? [];
        list.push({ cellId: cell.id, member, via });
        byKey.set(key, list);
      }
    }
  }
  return byKey;
}

export function ownerCellId(
  cells: GmCell[],
  row: { gmUserId?: string | null; gmName?: string | null }
): string | null {
  return ownerFromIndex(indexCells(cells), row, cells);
}

function ownerFromIndex(
  index: Map<string, OwnerHit[]>,
  row: { gmUserId?: string | null; gmName?: string | null },
  cells: GmCell[] = []
): string | null {
  const keys = rowIdentityKeys(row);
  const idHits = new Set<string>();
  const nameHits = new Set<string>();
  for (const key of keys) {
    for (const hit of index.get(key) ?? []) {
      if (hit.via === "id") idHits.add(hit.cellId);
      else nameHits.add(hit.cellId);
    }
  }
  if (idHits.size === 1) return [...idHits][0];
  if (idHits.size > 1) return null;

  const cellName = usefulMemberName(row.gmName ?? "");
  if (cellName) {
    const named = cells.filter(
      (cell) => usefulMemberName(cell.groupName) === cellName
    );
    if (named.length === 1) return named[0].id;
  }

  if (nameHits.size === 1) return [...nameHits][0];
  return null;
}

export function rewardsForCell(
  cell: GmCell,
  rows: GroupRewardEntry[],
  cells: GmCell[]
) {
  return groupRewardsByCell(cells, rows).get(cell.id) ?? [];
}

export function groupRewardsByCell(cells: GmCell[], rows: GroupRewardEntry[]) {
  const map = new Map<string, GroupRewardEntry[]>(
    cells.map((cell) => [cell.id, []])
  );
  const roster = cells.map((cell) => ({
    id: cell.id,
    name: usefulMemberName(cell.groupName),
    members: uniquePeople(cell.members),
  }));

  for (const row of rows) {
    const keys = rowIdentityKeys(row);
    const rowName = usefulMemberName(row.gmName ?? "");
    const scored = roster
      .map((item) => {
        let score = 0;
        if (item.name && rowName && item.name === rowName) score += 80;
        for (const member of item.members) {
          const mk = memberIdentityKeys(member);
          if (keys.some((key) => mk.includes(key) && key.startsWith("d:"))) score += 50;
          if (keys.some((key) => mk.includes(key) && key.startsWith("u:"))) score += 40;
          const memberName = usefulMemberName(member.displayName);
          if (memberName && rowName && memberName === rowName) {
            score += member.cellRole === "PRINCIPAL" ? 20 : 12;
          }
        }
        return { id: item.id, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    if (!best) continue;
    if (second && second.score === best.score) continue;
    map.get(best.id)?.push(row);
  }
  return map;
}

export function rewardByCellMembers(
  cell: GmCell,
  row: GroupRewardEntry,
  cells: GmCell[] = [cell]
) {
  return ownerCellId(cells, row) === cell.id;
}

export function memberOwnsRow(member: GmCellMember, row: GroupRewardEntry) {
  const memberKeys = new Set(memberIdentityKeys(member));
  return rowIdentityKeys(row).some((key) => memberKeys.has(key));
}

function membersForReward(cell: GmCell, row: GroupRewardEntry) {
  const hits = uniqueMembers(cell.members).filter((member) =>
    memberOwnsRow(member, row)
  );
  return hits.flatMap((member) => memberIdentityKeys(member));
}

function rewardBelongsToManagedGroup(cell: GmCell, row: GroupRewardEntry) {
  const catalog = resolveRpGroup(cell.groupName);
  if (catalog && (row.groupId === catalog.id || fold(row.groupName) === fold(catalog.name))) {
    return true;
  }
  return fold(row.groupName) === fold(cell.groupName) && Boolean(fold(cell.groupName));
}

export function listGmCellActivity(
  cell: GmCell,
  allCells: GmCell[] = [cell]
): GmActivityItem[] {
  const items: GmActivityItem[] = [];
  const seen = new Set<string>();
  const catalog = resolveRpGroup(cell.groupName);
  const members = uniqueMembers(cell.members);
  const memberKeys = new Set(members.flatMap(memberIdentityKeys));

  const push = (item: GmActivityItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  const authorIsMember = (authorId?: string | null, authorName?: string | null) => {
    if (ownerCellId(allCells, { gmUserId: authorId, gmName: authorName }) === cell.id) {
      return true;
    }
    return rowIdentityKeys({ gmUserId: authorId, gmName: authorName }).some((key) =>
      memberKeys.has(key)
    );
  };

  for (const mission of listMissions()) {
    const byPeople = authorIsMember(mission.authorId, mission.authorName);
    const byGroup =
      mission.authorGroupId === cell.id ||
      (catalog &&
        (fold(mission.authorGroupName ?? "") === fold(catalog.name) ||
          mission.groupIds?.includes(catalog.id)));
    if (!byPeople && !byGroup) continue;
    if (byGroup && !byPeople && ownerCellId(allCells, { gmUserId: mission.authorId, gmName: mission.authorName })) {
      continue;
    }
    let orRouge = 0;
    let orBleu = 0;
    for (const r of mission.orRewards ?? []) {
      if (
        catalog &&
        r.groupId &&
        r.groupId !== catalog.id &&
        r.groupId !== cell.id
      ) {
        continue;
      }
      if (r.color === "rouge") orRouge += r.amount;
      else orBleu += r.amount;
    }
    push({
      id: `m-${mission.id}`,
      title: mission.title || "Mission",
      when: mission.updatedAt || mission.createdAt,
      detail: [mission.duration, mission.status, mission.authorName]
        .filter(Boolean)
        .join(" · "),
      kind: "mission",
      memberIds: mission.authorId ? [fold(mission.authorId)] : [],
      orRouge,
      orBleu,
    });
  }

  for (const row of listCataloguedDiscordMissions()) {
    const byPeople = (row.gmNames ?? []).some(
      (name) => ownerCellId(allCells, { gmName: name }) === cell.id
    );
    const byGroup = row.groups.some(
      (g) =>
        fold(g.name) === fold(cell.groupName) ||
        (catalog && (fold(g.name) === fold(catalog.name) || g.id === catalog.id))
    );
    if (!byPeople && !byGroup) continue;
    if (byGroup && !byPeople) {
      const claimed = (row.gmNames ?? []).some((name) =>
        Boolean(ownerCellId(allCells, { gmName: name }))
      );
      if (claimed) continue;
    }
    push({
      id: `d-${row.id}`,
      title: row.title || "Mission Discord",
      when: row.createdAt,
      detail: [row.duration, row.groups.map((g) => g.name).join(", ")]
        .filter(Boolean)
        .join(" · "),
      kind: "mission",
      memberIds: [],
      orRouge: 0,
      orBleu: 0,
    });
  }

  for (const row of listGroupRewards()) {
    const mine = rewardByCellMembers(cell, row, allCells);
    if (!mine && rewardBelongsToManagedGroup(cell, row)) {
      if (ownerCellId(allCells, row)) continue;
    } else if (!mine) {
      continue;
    }
    push({
      id: `r-${row.id}`,
      title: `${row.amount} ${orColorLabel(row.color)} · ${row.groupName}`,
      when: row.createdAt || `${row.missionDate}T${row.startTime || "00:00"}:00`,
      detail: `GM ${row.gmName}${row.rewardNote ? ` · ${row.rewardNote}` : ""}`,
      kind: "suivi",
      memberIds: membersForReward(cell, row),
      orRouge: row.color === "rouge" ? row.amount : 0,
      orBleu: row.color === "bleu" ? row.amount : 0,
    });
  }

  return items.sort(
    (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
  );
}

export function summarizeGmCellActivity(cell: GmCell, allCells?: GmCell[]) {
  const log = listGmCellActivity(cell, allCells);
  let orRouge = 0;
  let orBleu = 0;
  for (const item of log) {
    orRouge += item.orRouge;
    orBleu += item.orBleu;
  }
  return {
    log,
    missionCount: log.filter((i) => i.kind === "mission").length,
    suiviCount: log.filter((i) => i.kind === "suivi").length,
    orRouge,
    orBleu,
  };
}

export function activityForMember(log: GmActivityItem[], member: GmCellMember) {
  const keys = new Set(memberIdentityKeys(member));
  const name = usefulMemberName(member.displayName);
  return log.filter((item) => {
    if (item.memberIds.some((id) => keys.has(id) || keys.has(`u:${id}`) || keys.has(`d:${id}`))) {
      return true;
    }
    if (name && foldName(item.detail).includes(name)) return true;
    return false;
  });
}

export function getGmCellStats(cellId: string): GmCellStats | null {
  const cell = getGmCell(cellId);
  if (!cell) return null;
  const cells = listGmCells();
  const catalog = resolveRpGroup(cell.groupName);
  const summary = summarizeGmCellActivity(cell, cells);
  return {
    cellId,
    groupName: catalog?.name || cell.groupName,
    missionCount: summary.missionCount + summary.suiviCount,
    approvedCount: summary.missionCount,
    orRouge: summary.orRouge,
    orBleu: summary.orBleu,
  };
}
