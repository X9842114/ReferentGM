import { kvRead, kvWrite } from "@/lib/app-kv";
import { listGmCells, type GmCellRoleId } from "@/lib/gm-cells";
import { notifyReferentStaff } from "@/lib/notifications";
import {
  orColorForKind,
  orColorLabel,
  type OrColor,
} from "@/lib/or-rewards";
import { findRpGroup, resolveRpGroup, type GroupKind, type RpGroupOption } from "@/lib/rp-groups";

export type GroupRewardEntry = {
  id: string;
  batchId: string;
  missionTitle: string;
  missionDate: string;
  startTime: string;
  groupId: string;
  groupName: string;
  gmName: string;
  gmUserId: string | null;
  color: OrColor;
  amount: number;
  rewardNote: string;
  suivi: string;
  loggedBy: string;
  loggedByName: string;
  createdAt: string;
};

const KEY = "refgm.group-rewards.v1";

function readAll(): GroupRewardEntry[] {
  const parsed = kvRead<GroupRewardEntry[]>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeEntry);
}

function normalizeEntry(row: Partial<GroupRewardEntry> & { id: string }): GroupRewardEntry {
  const createdAt = row.createdAt ?? new Date().toISOString();
  const fromCreated = new Date(createdAt);
  const missionDate =
    row.missionDate ||
    (Number.isNaN(fromCreated.getTime())
      ? ""
      : `${fromCreated.getFullYear()}-${String(fromCreated.getMonth() + 1).padStart(2, "0")}-${String(fromCreated.getDate()).padStart(2, "0")}`);
  const startTime =
    row.startTime ||
    (Number.isNaN(fromCreated.getTime())
      ? ""
      : `${String(fromCreated.getHours()).padStart(2, "0")}:${String(fromCreated.getMinutes()).padStart(2, "0")}`);
  return {
    id: row.id,
    batchId: row.batchId || row.id,
    missionTitle: (row.missionTitle ?? "").trim(),
    missionDate,
    startTime,
    groupId: row.groupId ?? "",
    groupName: row.groupName ?? "",
    gmName: row.gmName ?? "",
    gmUserId: row.gmUserId ?? null,
    color: row.color === "rouge" ? "rouge" : "bleu",
    amount: Number(row.amount) || 0,
    rewardNote: row.rewardNote ?? "",
    suivi: row.suivi ?? "",
    loggedBy: row.loggedBy ?? "",
    loggedByName: row.loggedByName ?? "",
    createdAt,
  };
}

function writeAll(rows: GroupRewardEntry[]) {
  kvWrite(KEY, rows.slice(0, 500), "refgm:group-rewards-updated");
}

export function listGroupRewards(): GroupRewardEntry[] {
  return [...readAll()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listMissionGms() {
  const byKey = new Map<
    string,
    {
      userId: string;
      displayName: string;
      discordId: string;
      role: GmCellRoleId | null;
      cells: string[];
    }
  >();
  const add = (
    userId: string,
    displayName: string,
    discordId: string,
    cellName?: string,
    role?: GmCellRoleId
  ) => {
    const name = displayName.trim();
    if (!name) return;
    const key = userId.trim() || name.toLowerCase();
    const prev = byKey.get(key) ?? {
      userId: userId.trim(),
      displayName: name,
      discordId: discordId.trim(),
      role: null,
      cells: [],
    };
    if (discordId.trim() && !prev.discordId) prev.discordId = discordId.trim();
    if (userId.trim() && !prev.userId) prev.userId = userId.trim();
    if (cellName?.trim() && !prev.cells.includes(cellName.trim())) {
      prev.cells.push(cellName.trim());
    }
    if (role && (role === "PRINCIPAL" || !prev.role)) prev.role = role;
    byKey.set(key, prev);
  };
  for (const cell of listGmCells()) {
    for (const member of cell.members) {
      add(
        member.userId,
        member.displayName,
        member.discordId,
        cell.groupName,
        member.cellRole
      );
    }
  }
  for (const row of listGroupRewards()) {
    const name = row.gmName.trim();
    if (!name) continue;
    const already = [...byKey.values()].some(
      (gm) =>
        (row.gmUserId && gm.userId === row.gmUserId) ||
        gm.displayName.toLowerCase() === name.toLowerCase()
    );
    if (!already) add(row.gmUserId ?? "", name, "", undefined, undefined);
  }
  return [...byKey.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "fr")
  );
}

export function gmsForGroup(group: RpGroupOption | null) {
  const cells = listGmCells();
  if (!group) {
    return [
      ...new Set(
        cells.flatMap((cell) =>
          cell.members.map((m) => m.displayName).filter(Boolean)
        )
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));
  }
  const needle = group.name.toLowerCase();
  const matched = cells.filter(
    (cell) => cell.groupName.toLowerCase() === needle
  );
  const names = matched.flatMap((cell) =>
    cell.members.map((m) => m.displayName).filter(Boolean)
  );
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "fr"));
}

export function buildGroupSuivi(input: {
  groupName: string;
  gmName: string;
  color: OrColor;
  amount: number;
  rewardNote: string;
  referentName: string;
}) {
  return [
    `📌 Suivi groupe`,
    `Groupe : ${input.groupName}`,
    `GM : ${input.gmName || "non renseigné"}`,
    `Récompense : ${input.amount} ${orColorLabel(input.color)}${
      input.rewardNote ? ` · ${input.rewardNote}` : ""
    }`,
    `Référent : ${input.referentName}`,
  ].join("\n");
}

export function saveGroupReward(input: {
  groupId: string;
  groupName?: string;
  kind?: GroupKind;
  gmName?: string;
  gmUserId?: string | null;
  amount: number;
  rewardNote?: string;
  suivi?: string;
  loggedBy: string;
  loggedByName: string;
  missionTitle?: string;
  missionDate?: string;
  startTime?: string;
  batchId?: string;
  silent?: boolean;
}): GroupRewardEntry | null {
  const catalog = findRpGroup(input.groupId);
  const groupName = (input.groupName ?? catalog?.name ?? "").trim();
  if (!catalog && !groupName) return null;
  const kind = catalog?.kind ?? input.kind ?? "GANG";
  const color = orColorForKind(kind);
  const gmName = (input.gmName ?? "").trim();
  const amount = Math.max(0, Math.round(input.amount));
  const rewardNote = (input.rewardNote ?? "").trim();
  const referentName = input.loggedByName.trim() || "Référent";
  const missionDate = (input.missionDate ?? "").trim();
  const startTime = (input.startTime ?? "").trim();
  const stamp =
    missionDate && startTime
      ? new Date(`${missionDate}T${startTime}:00`)
      : new Date();
  const createdAt = Number.isNaN(stamp.getTime())
    ? new Date().toISOString()
    : stamp.toISOString();
  const row = normalizeEntry({
    id: crypto.randomUUID(),
    batchId: input.batchId || crypto.randomUUID(),
    missionTitle: input.missionTitle ?? "",
    missionDate,
    startTime,
    groupId: catalog?.id || input.groupId || `libre:${crypto.randomUUID()}`,
    groupName: catalog?.name || groupName,
    gmName,
    gmUserId: input.gmUserId ?? null,
    color,
    amount,
    rewardNote,
    suivi:
      input.suivi?.trim() ||
      buildGroupSuivi({
        groupName: catalog?.name || groupName,
        gmName,
        color,
        amount,
        rewardNote,
        referentName,
      }),
    loggedBy: input.loggedBy,
    loggedByName: referentName,
    createdAt,
  });
  writeAll([row, ...readAll()]);
  if (!input.silent) {
    void notifyReferentStaff({
    type: "groupe.recompense",
    title: row.missionTitle || "Mission groupe",
    body: `${row.groupName} · ${row.amount} ${orColorLabel(row.color)}`,
    href: "/dashboard/suivi-groupes",
    excludeUserId: input.loggedBy,
  });
  }
  return row;
}

export function saveGroupMission(input: {
  title: string;
  groupIds: string[];
  customGroups?: { name: string; kind: GroupKind }[];
  date: string;
  startTime: string;
  rewards: string;
  amount?: number;
  amounts?: Record<string, number>;
  gmName?: string;
  gmUserId?: string | null;
  loggedBy: string;
  loggedByName: string;
}): GroupRewardEntry[] {
  const gmName = (input.gmName ?? "").trim();
  if (!gmName) return [];
  const ids = [...new Set(input.groupIds.filter(Boolean))];
  const custom = (input.customGroups ?? []).filter((g) => g.name.trim());
  const title = input.title.trim() || "Mission";
  const date = input.date.trim();
  const batchId = crypto.randomUUID();
  const created: GroupRewardEntry[] = [];
  const targets: {
    groupId: string;
    groupName?: string;
    kind?: GroupKind;
  }[] = [
    ...ids.map((groupId) => ({ groupId })),
    ...custom.map((g) => ({
      groupId: `libre:${crypto.randomUUID()}`,
      groupName: g.name.trim(),
      kind: g.kind,
    })),
  ];
  if (!targets.length) return [];
  for (const target of targets) {
    const amount =
      input.amounts?.[target.groupId] ?? input.amount ?? 0;
    const row = saveGroupReward({
      ...target,
      gmName,
      gmUserId: input.gmUserId ?? null,
      amount,
      rewardNote: input.rewards,
      loggedBy: input.loggedBy,
      loggedByName: input.loggedByName,
      missionTitle: title,
      missionDate: date,
      startTime: input.startTime,
      batchId,
      silent: true,
    });
    if (row) created.push(row);
  }
  if (created.length) {
    const recap = created
      .map((r) => `${r.groupName} ${r.amount} ${orColorLabel(r.color)}`)
      .join(" · ");
    void notifyReferentStaff({
      type: "groupe.recompense",
      title,
      body: recap || input.rewards,
      href: "/dashboard/suivi-groupes",
      excludeUserId: input.loggedBy,
    });
  }
  return created;
}

export type MissionBatch = {
  batchId: string;
  title: string;
  date: string;
  startTime: string;
  rewards: string;
  loggedByName: string;
  createdAt: string;
  groups: GroupRewardEntry[];
};

export function listMissionBatches(rows: GroupRewardEntry[]): MissionBatch[] {
  const map = new Map<string, GroupRewardEntry[]>();
  for (const row of rows) {
    const key = row.batchId || row.id;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.values()]
    .map((groups) => {
      const head = groups[0];
      return {
        batchId: head.batchId,
        title: head.missionTitle || groups.map((g) => g.groupName).join(", "),
        date: head.missionDate,
        startTime: head.startTime,
        rewards: head.rewardNote,
        loggedByName: head.loggedByName,
        createdAt: head.createdAt,
        groups,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getGroupReward(id: string): GroupRewardEntry | null {
  return readAll().find((row) => row.id === id) ?? null;
}

export function updateGroupReward(
  id: string,
  patch: {
    missionTitle?: string;
    amount?: number;
    gmName?: string;
    rewardNote?: string;
    missionDate?: string;
    startTime?: string;
  }
): GroupRewardEntry | null {
  let updated: GroupRewardEntry | null = null;
  const next = readAll().map((row) => {
    if (row.id !== id) return row;
    const amount =
      patch.amount === undefined
        ? row.amount
        : Math.max(0, Math.round(Number(patch.amount) || 0));
    const gmName =
      patch.gmName === undefined ? row.gmName : patch.gmName.trim();
    const rewardNote =
      patch.rewardNote === undefined ? row.rewardNote : patch.rewardNote.trim();
    const missionTitle =
      patch.missionTitle === undefined
        ? row.missionTitle
        : patch.missionTitle.trim() || row.missionTitle;
    const missionDate =
      patch.missionDate === undefined
        ? row.missionDate
        : patch.missionDate.trim();
    const startTime =
      patch.startTime === undefined ? row.startTime : patch.startTime.trim();
    updated = normalizeEntry({
      ...row,
      amount,
      gmName,
      rewardNote,
      missionTitle,
      missionDate,
      startTime,
      suivi: buildGroupSuivi({
        groupName: row.groupName,
        gmName,
        color: row.color,
        amount,
        rewardNote,
        referentName: row.loggedByName,
      }),
    });
    return updated;
  });
  if (!updated) return null;
  writeAll(next);
  return updated;
}

export function deleteGroupReward(id: string) {
  writeAll(readAll().filter((row) => row.id !== id));
}

export function deleteGroupRewards(ids: string[]) {
  const drop = new Set(ids.filter(Boolean));
  if (!drop.size) return;
  writeAll(readAll().filter((row) => !drop.has(row.id)));
}

export function syncGroupRewardIdentity(
  fromId: string,
  to: { id: string; name: string }
) {
  let changed = false;
  const next = readAll().map((row) => {
    if (row.groupId !== fromId) return row;
    changed = true;
    return { ...row, groupId: to.id, groupName: to.name };
  });
  if (changed) writeAll(next);
}

export function filterRewardsByRange(
  rows: GroupRewardEntry[],
  fromIso: string,
  toIso: string
) {
  const from = fromIso ? new Date(`${fromIso}T00:00:00`) : null;
  const to = toIso ? new Date(`${toIso}T23:59:59`) : null;
  return rows.filter((row) => {
    const t = new Date(row.createdAt).getTime();
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  });
}

export type GroupCardStats = {
  count: number;
  bleu: number;
  rouge: number;
  lastAt: string;
  lastTitle: string;
  lastNote: string;
  gmNames: string[];
  recent: {
    title: string;
    date: string;
    amount: number;
    color: OrColor;
  }[];
};

export function statsByGroupId(rows: GroupRewardEntry[]) {
  const map = new Map<string, GroupRewardEntry[]>();
  for (const row of rows) {
    const list = map.get(row.groupId) ?? [];
    list.push(row);
    map.set(row.groupId, list);
  }
  const out: Record<string, GroupCardStats> = {};
  for (const [id, list] of map) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const head = sorted[0];
    const gms = [
      ...new Set(sorted.map((r) => r.gmName.trim()).filter(Boolean)),
    ];
    out[id] = {
      count: sorted.length,
      bleu: sorted.reduce((n, r) => n + (r.color === "bleu" ? r.amount : 0), 0),
      rouge: sorted.reduce((n, r) => n + (r.color === "rouge" ? r.amount : 0), 0),
      lastAt: head.createdAt,
      lastTitle: head.missionTitle,
      lastNote: head.rewardNote,
      gmNames: gms,
      recent: sorted.slice(0, 4).map((r) => ({
        title: r.missionTitle || "Mission",
        date: r.missionDate,
        amount: r.amount,
        color: r.color,
      })),
    };
  }
  return out;
}

export type GmRewardRecap = {
  gmName: string;
  gmUserId: string | null;
  count: number;
  bleu: number;
  rouge: number;
};

export type GroupRewardRecap = {
  groupId: string;
  groupName: string;
  lastAt: string;
  lastGm: string;
  count: number;
  bleu: number;
  rouge: number;
};

export function recapGroupRewards(rows: GroupRewardEntry[]) {
  const byGm = new Map<string, GmRewardRecap>();
  const byGroup = new Map<
    string,
    GroupRewardRecap & { batches: Set<string> }
  >();
  let bleu = 0;
  let rouge = 0;

  const groupKey = (row: GroupRewardEntry) => {
    const catalog =
      findRpGroup(row.groupId) || resolveRpGroup(row.groupName || row.groupId);
    if (catalog) return `id:${catalog.id}`;
    const name = row.groupName.trim().toLowerCase();
    if (name) return `n:${name}`;
    return `x:${row.groupId || row.id}`;
  };

  for (const row of rows) {
    if (row.color === "bleu") bleu += row.amount;
    else rouge += row.amount;

    const gmKey = row.gmName.trim() || "Non renseigné";
    const gm = byGm.get(gmKey) ?? {
      gmName: gmKey,
      gmUserId: row.gmUserId ?? null,
      count: 0,
      bleu: 0,
      rouge: 0,
    };
    if (!gm.gmUserId && row.gmUserId) gm.gmUserId = row.gmUserId;
    gm.count += 1;
    if (row.color === "bleu") gm.bleu += row.amount;
    else gm.rouge += row.amount;
    byGm.set(gmKey, gm);

    const key = groupKey(row);
    const catalog =
      findRpGroup(row.groupId) || resolveRpGroup(row.groupName || row.groupId);
    const existing = byGroup.get(key);
    const batch = row.batchId || row.id;
    if (!existing) {
      byGroup.set(key, {
        groupId: catalog?.id || row.groupId,
        groupName: catalog?.name || row.groupName,
        lastAt: row.createdAt,
        lastGm: row.gmName,
        count: 1,
        bleu: row.color === "bleu" ? row.amount : 0,
        rouge: row.color === "rouge" ? row.amount : 0,
        batches: new Set([batch]),
      });
    } else {
      existing.batches.add(batch);
      existing.count = existing.batches.size;
      if (row.color === "bleu") existing.bleu += row.amount;
      else existing.rouge += row.amount;
      if (new Date(row.createdAt) > new Date(existing.lastAt)) {
        existing.lastAt = row.createdAt;
        existing.lastGm = row.gmName;
      }
    }
  }

  return {
    count: new Set(rows.map((row) => row.batchId || row.id)).size,
    bleu,
    rouge,
    byGm: [...byGm.values()].sort((a, b) => b.count - a.count),
    byGroup: [...byGroup.values()]
      .map(({ batches: _batches, ...row }) => row)
      .sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      ),
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function savePng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function paintPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#07070a");
  bg.addColorStop(0.55, "#0c0c10");
  bg.addColorStop(1, "#120810");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  glow(ctx, 180, 60, 260, "rgba(125,211,252,0.14)");
  glow(ctx, 980, 180, 280, "rgba(251,113,133,0.12)");
  glow(ctx, 700, h - 80, 320, "rgba(167,139,250,0.1)");
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  values: number[],
  color: string
) {
  if (values.length < 2) return;
  const max = Math.max(1, ...values);
  ctx.beginPath();
  values.forEach((v, i) => {
    const px = x + (i / (values.length - 1)) * w;
    const py = y + h - (v / max) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = "rgba(196,181,253,0.16)";
  ctx.fill();
  ctx.beginPath();
  values.forEach((v, i) => {
    const px = x + (i / (values.length - 1)) * w;
    const py = y + h - (v / max) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  const last = values[values.length - 1];
  const lx = x + w;
  const ly = y + h - (last / max) * h;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fill();
}

export async function downloadGroupRewardsPng(
  recap: ReturnType<typeof recapGroupRewards>,
  label: string,
  filename: string,
  spark: number[] = []
) {
  const w = 1080;
  const groups = recap.byGroup
    .slice()
    .sort((a, b) => b.bleu + b.rouge - (a.bleu + a.rouge));
  const gms = recap.byGm.filter((g) => g.gmName !== "Non renseigné");
  const rowH = 48;
  const h = Math.max(
    760,
    620 + groups.length * rowH + 56 + Math.max(gms.length, 1) * 40 + 80
  );
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [orBleu, orRouge] = await Promise.all([
    loadPng("/or/or-bleu.png"),
    loadPng("/or/or-rouge.png"),
  ]);
  paintPoster(ctx, w, h);
  const pad = 72;

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("REFGM", pad, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "700 48px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Suivi groupes", pad, 126);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(
    `${label}  ·  ${recap.count} lignes  ·  ${groups.length} groupes  ·  ${gms.length} GM`,
    pad,
    164
  );

  ctx.fillStyle = "#fff";
  ctx.font = "200 78px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(String(recap.bleu + recap.rouge), pad, 260);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("or cumulé", pad + 8, 294);

  drawSpark(
    ctx,
    pad,
    318,
    w - pad * 2,
    72,
    spark.length ? spark : [0, recap.bleu + recap.rouge],
    "#c4b5fd"
  );

  let x = pad;
  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  if (orBleu) {
    ctx.drawImage(orBleu, x, 410, 26, 26);
    x += 34;
  }
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText(String(recap.bleu), x, 430);
  x += ctx.measureText(String(recap.bleu)).width + 28;
  if (orRouge) {
    ctx.drawImage(orRouge, x, 410, 26, 26);
    x += 34;
  }
  ctx.fillStyle = "#fda4af";
  ctx.fillText(String(recap.rouge), x, 430);

  let y = 470;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`TOUS LES GROUPES (${groups.length})`, pad, y);
  y += 14;
  groups.forEach((g, i) => {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, pad, y, w - pad * 2, 40, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(String(i + 1), pad + 16, y + 26);
    ctx.fillStyle = "#fff";
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(clip(ctx, g.groupName, 480), pad + 48, y + 26);
    const meta = `${g.count} miss.  ·  ${g.lastGm || "-"}`;
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(clip(ctx, meta, 220), pad + 540, y + 26);
    const gold = String(g.bleu + g.rouge);
    ctx.fillStyle = g.rouge > g.bleu ? "#fda4af" : "#7dd3fc";
    ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(gold, w - pad - 20 - ctx.measureText(gold).width, y + 26);
    y += rowH;
  });

  y += 18;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`GAMEMASTERS (${gms.length})`, pad, y);
  y += 14;
  gms.forEach((g) => {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, pad, y, w - pad * 2, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "600 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(clip(ctx, g.gmName, 520), pad + 18, y + 23);
    const meta = `${g.count} miss.  ·  ${g.bleu + g.rouge} or`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(meta, w - pad - 18 - ctx.measureText(meta).width, y + 23);
    y += 40;
  });

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("refgm · CSV pour le détail mission par mission", pad, h - 28);
  savePng(canvas, filename);
}

export async function downloadGmStatsPng(input: {
  gmName: string;
  periodLabel: string;
  rows: GroupRewardEntry[];
}) {
  const recap = recapGroupRewards(input.rows);
  const groups = recap.byGroup
    .slice()
    .sort((a, b) => b.count - a.count || b.bleu + b.rouge - (a.bleu + a.rouge));
  const w = 1080;
  const h = 640 + Math.max(groups.length, 1) * 76;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [orBleu, orRouge] = await Promise.all([
    loadPng("/or/or-bleu.png"),
    loadPng("/or/or-rouge.png"),
  ]);
  paintPoster(ctx, w, h);
  const pad = 72;

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("FICHE GAMEMASTER", pad, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "700 48px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(clip(ctx, input.gmName, 900), pad, 128);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(input.periodLabel, pad, 166);

  ctx.fillStyle = "#fff";
  ctx.font = "200 72px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(String(recap.count), pad, 260);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(recap.count === 1 ? "mission" : "missions", pad + 8, 294);

  let x = pad;
  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  if (orBleu) {
    ctx.drawImage(orBleu, x, 330, 28, 28);
    x += 36;
  }
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText(String(recap.bleu), x, 352);
  x += ctx.measureText(String(recap.bleu)).width + 28;
  if (orRouge) {
    ctx.drawImage(orRouge, x, 330, 28, 28);
    x += 36;
  }
  ctx.fillStyle = "#fda4af";
  ctx.fillText(String(recap.rouge), x, 352);

  let y = 410;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("GROUPES MISSIONNÉS", pad, y);
  y += 18;
  if (!groups.length) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Aucun groupe.", pad, y + 36);
  } else {
    groups.forEach((g) => {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, pad, y, w - pad * 2, 64, 16);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(clip(ctx, g.groupName, 560), pad + 24, y + 40);
      const meta = `${g.count} miss.  ·  ${g.bleu + g.rouge} or`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "500 18px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(meta, w - pad - 24 - ctx.measureText(meta).width, y + 40);
      y += 72;
    });
  }

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("refgm", pad, h - 36);
  const slug = input.gmName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  savePng(canvas, `gm-${slug || "fiche"}.png`);
}

function loadPng(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
