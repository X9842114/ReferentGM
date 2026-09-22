import type { GmCell, GmCellMember } from "@/lib/gm-cells";

function fold(value: string) {
  return value.trim().toLowerCase();
}

function foldName(value: string) {
  return fold(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function snowflake(value: string) {
  const match = String(value ?? "").match(/(\d{17,20})/);
  return match?.[1] ?? "";
}

export function usefulMemberName(value: string) {
  const name = foldName(value);
  if (name.length < 2) return "";
  if (name === "gamemaster" || name === "nonrenseigne") return "";
  if (/^\d+$/.test(name)) return "";
  return name;
}

function asCellRole(raw: unknown): GmCellMember["cellRole"] | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (
    v === "PRINCIPAL" ||
    v === "LEAD" ||
    v === "LEAD_GM" ||
    v === "1" ||
    v === "0"
  ) {
    return "PRINCIPAL";
  }
  if (v === "BRAS_DROIT" || v === "DROIT" || v === "2") return "BRAS_DROIT";
  if (v === "BRAS_GAUCHE" || v === "GAUCHE" || v === "3") return "BRAS_GAUCHE";
  return null;
}

export function memberIdentityKeys(member: GmCellMember): string[] {
  const keys: string[] = [];
  const discord = snowflake(member.discordId) || snowflake(member.userId);
  if (discord) keys.push(`d:${discord}`);
  const userId = fold(member.userId);
  if (userId && !snowflake(member.userId)) keys.push(`u:${userId}`);
  const uniqueId = fold(member.uniqueId);
  if (uniqueId.length > 1 && uniqueId !== userId && uniqueId !== discord) {
    keys.push(`i:${uniqueId}`);
  }
  const name = nameKey(member.displayName);
  if (name) keys.push(name);
  return [...new Set(keys)];
}

export function namesOverlap(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  if (n < 6) return false;
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i >= 6 && Math.abs(a.length - b.length) <= 1;
}

function nameKey(value: string) {
  const name = usefulMemberName(value);
  if (!name) return "";
  return name.length >= 6 ? `n:${name.slice(0, 6)}` : `n:${name}`;
}

function memberFlake(member: GmCellMember) {
  return snowflake(member.discordId) || snowflake(member.userId);
}

export function sameGmPerson(a: GmCellMember, b: GmCellMember) {
  const fa = memberFlake(a);
  const fb = memberFlake(b);
  if (fa && fb && fa === fb) return true;
  const ua = fold(a.userId);
  const ub = fold(b.userId);
  if (ua && ub && ua === ub) return true;
  const ia = fold(a.uniqueId);
  const ib = fold(b.uniqueId);
  if (ia && ib && ia.length > 2 && ia === ib) return true;
  return namesOverlap(
    usefulMemberName(a.displayName),
    usefulMemberName(b.displayName)
  );
}

/** Une personne = une seule entrée, même si elle est en Lead + bras. */
export function uniquePeople(members: GmCellMember[]): GmCellMember[] {
  const out: GmCellMember[] = [];
  const order = (role: GmCellMember["cellRole"] | null) =>
    role === "PRINCIPAL" ? 0 : role === "BRAS_DROIT" ? 1 : role === "BRAS_GAUCHE" ? 2 : 3;
  const sorted = [...members].sort(
    (a, b) => order(asCellRole(a.cellRole)) - order(asCellRole(b.cellRole))
  );
  for (const raw of sorted) {
    if (!raw || typeof raw !== "object") continue;
    const role =
      asCellRole(raw.cellRole) ??
      (["PRINCIPAL", "BRAS_DROIT", "BRAS_GAUCHE"] as const).find(
        (item) => !out.some((person) => person.cellRole === item)
      ) ??
      "PRINCIPAL";
    const member: GmCellMember = { ...raw, cellRole: role };
    if (out.some((person) => sameGmPerson(person, member))) continue;
    if (out.length >= 3) break;
    if (out.some((person) => person.cellRole === member.cellRole)) {
      const free = (["PRINCIPAL", "BRAS_DROIT", "BRAS_GAUCHE"] as const).find(
        (item) => !out.some((person) => person.cellRole === item)
      );
      if (!free) continue;
      member.cellRole = free;
    }
    out.push(member);
  }
  return out.sort((a, b) => order(a.cellRole) - order(b.cellRole));
}

export function uniqueMembers(members: GmCellMember[]): GmCellMember[] {
  return uniquePeople(members);
}

function looksLikeTestGroup(name: string) {
  return /^[a-z0-9]{3,10}$/.test(name.trim());
}

/** Un même Discord / compte n’apparaît que dans une cellule. */
export function dedupeCellsMembers(cells: GmCell[]): GmCell[] {
  const seenIds = new Set<string>();
  const uniqueCells: GmCell[] = [];
  for (const cell of cells) {
    if (seenIds.has(cell.id)) continue;
    seenIds.add(cell.id);
    uniqueCells.push({ ...cell, members: uniqueMembers(cell.members) });
  }

  const owner = new Map<
    string,
    { cellId: string; strength: number; createdAt: string }
  >();
  const rankOf = (role: GmCellMember["cellRole"]) =>
    role === "PRINCIPAL" ? 3 : role === "BRAS_DROIT" ? 2 : 1;

  for (const cell of uniqueCells) {
    for (const member of cell.members) {
      const keys = memberIdentityKeys(member);
      const hasDiscord = keys.some((key) => key.startsWith("d:"));
      const strength =
        rankOf(member.cellRole) * 10 + keys.length + (hasDiscord ? 20 : 0);
      for (const key of keys) {
        const prev = owner.get(key);
        const next = {
          cellId: cell.id,
          strength,
          createdAt: cell.createdAt || "",
        };
        if (!prev || next.strength > prev.strength) {
          owner.set(key, next);
          continue;
        }
        if (
          next.strength === prev.strength &&
          looksLikeTestGroup(
            uniqueCells.find((item) => item.id === prev.cellId)?.groupName || ""
          ) &&
          !looksLikeTestGroup(cell.groupName)
        ) {
          owner.set(key, next);
          continue;
        }
        if (
          next.strength === prev.strength &&
          next.createdAt &&
          prev.createdAt &&
          next.createdAt < prev.createdAt &&
          looksLikeTestGroup(cell.groupName) ===
            looksLikeTestGroup(
              uniqueCells.find((item) => item.id === prev.cellId)?.groupName || ""
            )
        ) {
          owner.set(key, next);
        }
      }
    }
  }

  return uniqueCells.map((cell) => ({
    ...cell,
    members: cell.members.filter((member) => {
      const keys = memberIdentityKeys(member);
      if (!keys.length) return false;
      return keys.every((key) => owner.get(key)?.cellId === cell.id);
    }),
  }));
}

export function rowIdentityKeys(row: {
  gmUserId?: string | null;
  gmName?: string | null;
}): string[] {
  const keys: string[] = [];
  const id = fold(row.gmUserId ?? "");
  const flake = snowflake(row.gmUserId ?? "");
  if (flake) keys.push(`d:${flake}`);
  if (id && !flake) keys.push(`u:${id}`);
  const name = nameKey(row.gmName ?? "");
  if (name) keys.push(name);
  return [...new Set(keys)];
}
