import { kvRead, kvWrite } from "@/lib/app-kv";
import {
  dedupeCellsMembers,
  uniqueMembers,
  usefulMemberName,
} from "@/lib/gm-cell-identity";
import { listBusinesses, logActivity, type StaffBusiness } from "@/lib/staff-storage";

export type GmCellRoleId = "PRINCIPAL" | "BRAS_DROIT" | "BRAS_GAUCHE";

export type GmCellMember = {
  userId: string;
  displayName: string;
  uniqueId: string;
  discordId: string;
  cellRole: GmCellRoleId;
  permIg: boolean;
};

export type GmCell = {
  id: string;
  groupName: string;
  qgPosition: string;
  notes: string;
  /** Titre / nom de la trame */
  trameLabel: string;
  /** Infos trame visibles des référents */
  trameInfo: string;
  /** Avancement renseigné par les GM */
  trameStatus: string;
  /** Lien Gdoc / Notion / autre */
  trameLink: string;
  trameProgress?: number;
  trameStage?: string;
  trameNextStep?: string;
  trameUpdatedBy?: string;
  trameUpdatedAt?: string;
  members: GmCellMember[];
  createdAt: string;
  updatedAt: string;
};

export type GmDossier = {
  cell: GmCell | null;
  role: GmCellRoleId | null;
  businesses: StaffBusiness[];
};

const CELLS_KEY = "refgm.staff.gm-cells.v1";

export const GM_CELL_ROLE_LABEL: Record<GmCellRoleId, string> = {
  PRINCIPAL: "Lead GM",
  BRAS_DROIT: "Bras droit GM",
  BRAS_GAUCHE: "Bras gauche GM",
};

function readJson<T>(key: string, fallback: T): T {
  return kvRead(key, fallback);
}

function writeJson(key: string, value: unknown) {
  kvWrite(key, value, "refgm:staff-updated");
}

function uid() {
  return crypto.randomUUID();
}

function asCells(raw: unknown): GmCell[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { cells?: unknown }).cells)
      ? (raw as { cells: unknown[] }).cells
      : [];
  return list
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      groupName: String(row.groupName ?? ""),
      qgPosition: String(row.qgPosition ?? ""),
      notes: String(row.notes ?? ""),
      trameLabel: String(row.trameLabel ?? ""),
      trameInfo: String(row.trameInfo ?? ""),
      trameStatus: String(row.trameStatus ?? ""),
      trameLink: String(row.trameLink ?? ""),
      trameProgress: typeof row.trameProgress === "number" ? row.trameProgress : undefined,
      trameStage: String(row.trameStage ?? ""),
      trameNextStep: String(row.trameNextStep ?? ""),
      trameUpdatedBy: row.trameUpdatedBy ? String(row.trameUpdatedBy) : undefined,
      trameUpdatedAt: row.trameUpdatedAt ? String(row.trameUpdatedAt) : undefined,
      members: uniqueMembers(
        Array.isArray(row.members) ? (row.members as GmCellMember[]) : []
      ),
      createdAt: String(row.createdAt ?? ""),
      updatedAt: String(row.updatedAt ?? ""),
    }))
    .filter((cell) => cell.id);
}

export function listGmCells(): GmCell[] {
  return dedupeCellsMembers(asCells(readJson<unknown>(CELLS_KEY, []))).sort(
    (a, b) => a.groupName.localeCompare(b.groupName, "fr")
  );
}

export function getGmCell(id: string): GmCell | null {
  return listGmCells().find((c) => c.id === id) ?? null;
}

export function findGmCellForUser(userId: string): GmCell | null {
  if (!userId) return null;
  return (
    listGmCells().find((c) => c.members.some((m) => m.userId === userId)) ??
    null
  );
}

export function getMemberRole(
  cell: GmCell,
  userId: string
): GmCellRoleId | null {
  return cell.members.find((m) => m.userId === userId)?.cellRole ?? null;
}

export function businessesForUser(userId: string): StaffBusiness[] {
  if (!userId) return [];
  return listBusinesses().filter((b) => b.assigneeIds.includes(userId));
}

export function getGmDossier(userId: string): GmDossier {
  const cell = findGmCellForUser(userId);
  return {
    cell,
    role: cell ? getMemberRole(cell, userId) : null,
    businesses: businessesForUser(userId),
  };
}

function normalizeMembers(members: GmCellMember[]): GmCellMember[] {
  return uniqueMembers(
    members.map((m) => ({
      userId: (m.userId ?? "").trim(),
      displayName: (m.displayName ?? "").trim() || "GameMaster",
      uniqueId: (m.uniqueId ?? "").trim(),
      discordId: (m.discordId ?? "").trim(),
      cellRole: m.cellRole,
      permIg: Boolean(m.permIg),
    }))
  );
}

export function saveGmCell(
  input: Partial<GmCell> & {
    groupName: string;
    members: GmCellMember[];
  },
  actor?: { id?: string | null; name?: string }
): GmCell {
  const now = new Date().toISOString();
  const list = listGmCells();
  const members = normalizeMembers(input.members);
  const lead = members.find((m) => m.cellRole === "PRINCIPAL");
  if (!lead) {
    throw new Error("Un Lead (PRINCIPAL) est obligatoire.");
  }

  const usedElsewhere = new Set(
    list
      .filter((c) => c.id !== input.id)
      .flatMap((c) =>
        c.members.flatMap((m) =>
          [m.userId, m.discordId, usefulMemberName(m.displayName)].filter(
            Boolean
          )
        )
      )
  );
  for (const m of members) {
    const ids = [m.userId, m.discordId, usefulMemberName(m.displayName)].filter(
      Boolean
    );
    if (ids.some((id) => usedElsewhere.has(id))) {
      throw new Error(`${m.displayName} est déjà dans un autre groupe GM.`);
    }
  }

  if (input.id) {
    const idx = list.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      const prev = list[idx];
      const next: GmCell = {
        ...prev,
        groupName: input.groupName.trim(),
        qgPosition: (input.qgPosition ?? prev.qgPosition).trim(),
        notes: (input.notes ?? prev.notes).trim(),
        trameLabel: (input.trameLabel ?? prev.trameLabel ?? "").trim(),
        trameInfo: (input.trameInfo ?? prev.trameInfo ?? "").trim(),
        trameStatus: (input.trameStatus ?? prev.trameStatus ?? "").trim(),
        trameLink: (input.trameLink ?? prev.trameLink ?? "").trim(),
        trameProgress: input.trameProgress ?? prev.trameProgress,
        trameStage: (input.trameStage ?? prev.trameStage ?? "").trim(),
        trameNextStep: (input.trameNextStep ?? prev.trameNextStep ?? "").trim(),
        trameUpdatedBy: input.trameUpdatedBy ?? prev.trameUpdatedBy,
        trameUpdatedAt: input.trameUpdatedAt ?? prev.trameUpdatedAt,
        members,
        updatedAt: now,
      };
      list[idx] = next;
      writeJson(CELLS_KEY, list);
      logActivity({
        action: "gm-cell.updated",
        details: next.groupName,
        actorId: actor?.id,
        actorName: actor?.name,
      });
      return next;
    }
  }

  const created: GmCell = {
    id: uid(),
    groupName: input.groupName.trim(),
    qgPosition: (input.qgPosition ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    trameLabel: (input.trameLabel ?? "").trim(),
    trameInfo: (input.trameInfo ?? "").trim(),
    trameStatus: (input.trameStatus ?? "").trim(),
    trameLink: (input.trameLink ?? "").trim(),
    trameProgress: input.trameProgress,
    trameStage: (input.trameStage ?? "").trim(),
    trameNextStep: (input.trameNextStep ?? "").trim(),
    trameUpdatedBy: input.trameUpdatedBy,
    trameUpdatedAt: input.trameUpdatedAt,
    members,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(CELLS_KEY, [created, ...list]);
  logActivity({
    action: "gm-cell.created",
    details: created.groupName,
    actorId: actor?.id,
    actorName: actor?.name,
  });
  return created;
}

export function updateGmTrame(
  cellId: string,
  patch: {
    trameLabel?: string;
    trameInfo?: string;
    trameStatus?: string;
    trameLink?: string;
  },
  actor?: { id?: string | null; name?: string }
) {
  const cell = getGmCell(cellId);
  if (!cell) return null;
  return saveGmCell(
    {
      ...cell,
      ...patch,
      members: cell.members,
    },
    actor
  );
}

export function updateGmTrameStatus(
  cellId: string,
  trameStatus: string,
  actor?: { id?: string | null; name?: string }
) {
  const cell = getGmCell(cellId);
  if (!cell) return null;
  return saveGmCell(
    {
      ...cell,
      trameStatus,
      members: cell.members,
    },
    actor
  );
}

export type GmCellStats = {
  cellId: string;
  groupName: string;
  missionCount: number;
  approvedCount: number;
  orRouge: number;
  orBleu: number;
};

export function listGmCellsNormalized(): GmCell[] {
  return listGmCells().map((c) => ({
    ...c,
    trameLabel: c.trameLabel ?? "",
    trameInfo: c.trameInfo ?? "",
    trameStatus: c.trameStatus ?? "",
    trameLink: c.trameLink ?? "",
  }));
}

export function deleteGmCell(
  id: string,
  actor?: { id?: string | null; name?: string }
) {
  const list = listGmCells();
  const target = list.find((c) => c.id === id);
  writeJson(
    CELLS_KEY,
    list.filter((c) => c.id !== id)
  );
  if (target) {
    logActivity({
      action: "gm-cell.deleted",
      details: target.groupName,
      actorId: actor?.id,
      actorName: actor?.name,
    });
  }
}
