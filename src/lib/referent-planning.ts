import { kvRead, kvWrite } from "@/lib/app-kv";
import { pushNotifications } from "@/lib/notifications";

export type PlanningKind = "shift" | "task";
export type PlanningStatus = "open" | "done";
export type PlanningPriority = "urgent" | "important" | "todo" | "other";

export const PLANNING_PRIORITY_LABEL: Record<PlanningPriority, string> = {
  urgent: "Urgent",
  important: "Important",
  todo: "À faire",
  other: "Autre",
};

export function asPlanningPriority(value: unknown): PlanningPriority {
  if (value === "urgent" || value === "important" || value === "other") {
    return value;
  }
  return "todo";
}

export type PlanningMate = {
  userId: string;
  userName: string;
};

export type PlanningSlot = {
  id: string;
  kind: PlanningKind;
  status: PlanningStatus;
  date: string;
  start: string;
  end: string;
  userId: string;
  userName: string;
  assignees: PlanningMate[];
  title: string;
  note: string;
  createdBy: string;
  assignedById: string;
  assignedByName: string;
  createdAt: string;
  priority: PlanningPriority;
  tags: string[];
};

const KEY = "refgm.referent-planning.v1";

function readAll(): PlanningSlot[] {
  const parsed = kvRead<PlanningSlot[]>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeSlot);
}

function writeAll(rows: PlanningSlot[]) {
  kvWrite(KEY, rows.slice(0, 800), "refgm:planning-updated");
}

export function normalizeSlot(
  row: Partial<PlanningSlot> & { id: string }
): PlanningSlot {
  const kind: PlanningKind = row.kind === "task" ? "task" : "shift";
  const fallback: PlanningMate[] =
    row.userId && row.userName
      ? [{ userId: row.userId, userName: row.userName }]
      : [];
  const rawAssignees = Array.isArray(row.assignees) ? row.assignees : [];
  const seen = new Set<string>();
  const assignees: PlanningMate[] = [];
  for (const mate of [...rawAssignees, ...fallback]) {
    const id = mate.userId?.trim();
    const name = mate.userName?.trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    assignees.push({ userId: id, userName: name });
  }
  const lead = assignees[0];
  const tags = Array.isArray(row.tags)
    ? row.tags
        .map((tag) => String(tag ?? "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const priority = asPlanningPriority(row.priority);
  if (!tags.includes(PLANNING_PRIORITY_LABEL[priority])) {
    tags.unshift(PLANNING_PRIORITY_LABEL[priority]);
  }
  return {
    id: row.id,
    kind,
    status: row.status === "done" ? "done" : "open",
    date: row.date ?? "",
    start: row.start ?? "",
    end: row.end ?? "",
    userId: lead?.userId ?? "",
    userName: lead?.userName ?? "",
    assignees,
    title: row.title ?? "",
    note: row.note ?? "",
    createdBy: row.createdBy ?? "",
    assignedById: row.assignedById || row.createdBy || "",
    assignedByName: row.assignedByName ?? "",
    createdAt: row.createdAt ?? new Date().toISOString(),
    priority,
    tags: [...new Set(tags)],
  };
}

export function isOnSlot(
  slot: PlanningSlot,
  userId: string,
  displayName?: string | null
) {
  const id = userId.trim();
  if (id && slot.assignees.some((m) => m.userId === id)) return true;
  if (id && slot.userId === id) return true;
  if (id) return false;
  const name = (displayName ?? "").trim().toLowerCase();
  if (!name) return false;
  if (slot.assignees.some((m) => m.userName.trim().toLowerCase() === name)) {
    return true;
  }
  return slot.userName.trim().toLowerCase() === name;
}

export function listOpenTasksForUser(
  userId: string,
  displayName?: string | null
) {
  const id = userId.trim();
  if (!id && !(displayName ?? "").trim()) return [];
  const rank: Record<PlanningPriority, number> = {
    urgent: 0,
    important: 1,
    todo: 2,
    other: 3,
  };
  return listPlanningSlots()
    .filter(
      (slot) => slot.status === "open" && isOnSlot(slot, id, displayName)
    )
    .sort((a, b) => {
      const kind = Number(a.kind !== "task") - Number(b.kind !== "task");
      if (kind !== 0) return kind;
      const p = rank[a.priority] - rank[b.priority];
      if (p !== 0) return p;
      return a.date.localeCompare(b.date);
    });
}

export function listOpenTasks() {
  const rank: Record<PlanningPriority, number> = {
    urgent: 0,
    important: 1,
    todo: 2,
    other: 3,
  };
  return listPlanningSlots()
    .filter((slot) => slot.kind === "task" && slot.status === "open")
    .sort((a, b) => {
      const p = rank[a.priority] - rank[b.priority];
      if (p !== 0) return p;
      return a.date.localeCompare(b.date);
    });
}

export function listPlanningSlots(): PlanningSlot[] {
  return [...readAll()].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.start || "99:99").localeCompare(b.start || "99:99");
  });
}

export function listPlanningForRange(from: string, to: string) {
  return listPlanningSlots().filter(
    (slot) => slot.date >= from && slot.date <= to
  );
}

export function mondayOf(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function mondayFromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return mondayOf(new Date());
  return mondayOf(new Date(y, m - 1, d, 12, 0, 0));
}

export function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export function monthStartOf(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
}

export function monthGrid(monthStart: Date) {
  const first = monthStartOf(monthStart);
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatWeekLabel(days: Date[]) {
  if (!days.length) return "";
  const start = days[0];
  const end = days[days.length - 1];
  const month = start.toLocaleDateString("fr-FR", { month: "long" });
  const endMonth = end.toLocaleDateString("fr-FR", { month: "long" });
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} au ${end.getDate()} ${month} ${year}`;
  }
  return `${start.getDate()} ${month} au ${end.getDate()} ${endMonth} ${year}`;
}

function notifyAssignees(
  slot: PlanningSlot,
  exceptUserId: string,
  title: string,
  body: string
) {
  pushNotifications(
    slot.assignees.map((m) => m.userId).filter((id) => id !== exceptUserId),
    {
      type: slot.kind === "task" ? "planning.task" : "planning.shift",
      title,
      body,
      href: "/dashboard/planning",
    }
  );
}

export function savePlanningSlot(input: {
  kind?: PlanningKind;
  date: string;
  start?: string;
  end?: string;
  assignees?: PlanningMate[];
  userId?: string;
  userName?: string;
  title?: string;
  note?: string;
  priority?: PlanningPriority;
  tags?: string[];
  createdBy: string;
  assignedByName: string;
}): PlanningSlot | null {
  const date = input.date.trim();
  const kind: PlanningKind = input.kind === "task" ? "task" : "shift";
  if (!date) return null;
  const title =
    (input.title ?? "").trim() || (kind === "task" ? "Tâche" : "Permanence");
  const mates =
    input.assignees && input.assignees.length > 0
      ? input.assignees
      : input.userId && input.userName
        ? [{ userId: input.userId, userName: input.userName }]
        : [];
  const row = normalizeSlot({
    id: crypto.randomUUID(),
    kind,
    status: "open",
    date,
    start: (input.start ?? "").trim(),
    end: (input.end ?? "").trim(),
    userId: mates[0]?.userId ?? "",
    userName: mates[0]?.userName ?? "",
    assignees: mates,
    title,
    note: (input.note ?? "").trim(),
    createdBy: input.createdBy,
    assignedById: input.createdBy,
    assignedByName: input.assignedByName.trim() || "Référent",
    createdAt: new Date().toISOString(),
    priority: asPlanningPriority(input.priority),
    tags: input.tags ?? [],
  });
  writeAll([...readAll(), row]);

  notifyAssignees(
    row,
    input.createdBy,
    kind === "task" ? `Tâche : ${row.title}` : `Créneau : ${row.title}`,
    kind === "task"
      ? `${row.assignedByName} t’a mis sur « ${row.title} » (${row.date})`
      : `${row.assignedByName} t’a mis au planning le ${row.date}`
  );
  return row;
}

export function joinPlanningSlot(
  id: string,
  mate: PlanningMate,
  actor?: { id?: string; name?: string }
): PlanningSlot | null {
  const name = mate.userName.trim();
  const userId = mate.userId.trim();
  if (!id || !userId || !name) return null;
  let updated: PlanningSlot | null = null;
  let added = false;
  writeAll(
    readAll().map((row) => {
      if (row.id !== id || row.status === "done") return row;
      if (isOnSlot(row, userId)) {
        updated = row;
        return row;
      }
      added = true;
      const next = normalizeSlot({
        ...row,
        assignees: [...row.assignees, { userId, userName: name }],
      });
      updated = next;
      return next;
    })
  );
  if (updated && added) {
    const slot: PlanningSlot = updated;
    const by = actor?.name?.trim();
    pushNotifications([userId], {
      type: "planning.task",
      title: `Tâche : ${slot.title}`,
      body: by
        ? `${by} t’a assigné « ${slot.title} »`
        : `Tu es assigné sur « ${slot.title} ».`,
      href: "/dashboard",
    });
  }
  return updated;
}

export function leavePlanningSlot(id: string, userId: string) {
  writeAll(
    readAll().map((row) => {
      if (row.id !== id) return row;
      return normalizeSlot({
        ...row,
        assignees: row.assignees.filter((m) => m.userId !== userId),
        userId: "",
        userName: "",
      });
    })
  );
}

export function setPlanningStatus(id: string, status: PlanningStatus) {
  writeAll(
    readAll().map((row) => (row.id === id ? { ...row, status } : row))
  );
}

export function deletePlanningSlot(id: string) {
  writeAll(readAll().filter((row) => row.id !== id));
}

export function updatePlanningSlot(
  id: string,
  patch: {
    date?: string;
    start?: string;
    end?: string;
    title?: string;
    note?: string;
    kind?: PlanningKind;
    priority?: PlanningPriority;
    tags?: string[];
    assignees?: PlanningMate[];
  }
): PlanningSlot | null {
  let updated: PlanningSlot | null = null;
  writeAll(
    readAll().map((row) => {
      if (row.id !== id) return row;
      const next = normalizeSlot({
        ...row,
        date: patch.date ?? row.date,
        start: patch.start ?? row.start,
        end: patch.end ?? row.end,
        title: patch.title ?? row.title,
        note: patch.note ?? row.note,
        kind: patch.kind ?? row.kind,
        priority: patch.priority ?? row.priority,
        tags: patch.tags ?? row.tags,
        assignees: patch.assignees ?? row.assignees,
      });
      updated = next;
      return next;
    })
  );
  return updated;
}
