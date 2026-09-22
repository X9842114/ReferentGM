import { kvRead, kvWrite } from "@/lib/app-kv";
import { listAllAccounts } from "@/lib/accounts";
import { getGradeDef, granted } from "@/lib/grade-registry";
import { normalizeGrade } from "@/lib/grades";
import { logActivity } from "@/lib/staff-storage";
import { pushNotifications } from "@/lib/notifications";

export type StaffTaskStatus = "OPEN" | "DONE";

export type StaffTask = {
  id: string;
  title: string;
  body: string;
  assigneeIds: string[];
  dueAt: string | null;
  status: StaffTaskStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export type MeetingReminder = {
  id: string;
  title: string;
  meetingAt: string;
  note: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export type StaffBroadcast = {
  id: string;
  title: string;
  body: string;
  audience: "REFERENTS" | "ALL";
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export type StaffWarning = {
  id: string;
  targetUserId: string;
  targetName: string;
  reason: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

const KEYS = {
  tasks: "refgm.staff.tasks.v1",
  reminders: "refgm.staff.meeting-reminders.v1",
  broadcasts: "refgm.staff.broadcasts.v1",
  warnings: "refgm.staff.warnings.v1",
} as const;

function readJson<T>(key: string, fallback: T): T {
  return kvRead(key, fallback);
}

function writeJson(key: string, value: unknown) {
  kvWrite(key, value, "refgm:staff-updated");
}

function uid() {
  return crypto.randomUUID();
}

export function listStaffTasks(): StaffTask[] {
  return readJson<StaffTask[]>(KEYS.tasks, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function saveStaffTask(
  input: Omit<StaffTask, "id" | "createdAt" | "status"> & {
    id?: string;
    status?: StaffTaskStatus;
  }
): StaffTask {
  const list = listStaffTasks();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((t) => t.id === input.id);
    if (idx >= 0) {
      const next = {
        ...list[idx],
        ...input,
        status: input.status ?? list[idx].status,
        updatedAt: now,
      } as StaffTask;
      list[idx] = next;
      writeJson(KEYS.tasks, list);
      return next;
    }
  }
  const created: StaffTask = {
    id: uid(),
    title: input.title.trim(),
    body: input.body.trim(),
    assigneeIds: input.assigneeIds,
    dueAt: input.dueAt,
    status: "OPEN",
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt: now,
  };
  writeJson(KEYS.tasks, [created, ...list]);
  logActivity({
    action: "task.created",
    details: created.title,
    actorId: created.createdById,
    actorName: created.createdByName,
  });
  if (created.assigneeIds.length) {
    pushNotifications(created.assigneeIds, {
      type: "task.assigned",
      title: "Nouvelle tâche",
      body: created.title,
      href: "/dashboard",
    });
  }
  return created;
}

export function setTaskStatus(id: string, status: StaffTaskStatus) {
  const list = listStaffTasks();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], status };
  writeJson(KEYS.tasks, list);
}

export function deleteStaffTask(id: string) {
  writeJson(
    KEYS.tasks,
    listStaffTasks().filter((t) => t.id !== id)
  );
}

export function listMeetingReminders(): MeetingReminder[] {
  return readJson<MeetingReminder[]>(KEYS.reminders, []).sort(
    (a, b) => new Date(a.meetingAt).getTime() - new Date(b.meetingAt).getTime()
  );
}

export function saveMeetingReminder(input: {
  title: string;
  meetingAt: string;
  note: string;
  createdById: string;
  createdByName: string;
}): MeetingReminder {
  const row: MeetingReminder = {
    id: uid(),
    title: input.title.trim(),
    meetingAt: input.meetingAt,
    note: input.note.trim(),
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt: new Date().toISOString(),
  };
  writeJson(KEYS.reminders, [row, ...listMeetingReminders()]);
  void notifyReferents({
    type: "meeting.reminder",
    title: `Réunion · ${row.title}`,
    body: new Date(row.meetingAt).toLocaleString("fr-FR"),
    href: "/dashboard",
  });
  return row;
}

export function deleteMeetingReminder(id: string) {
  writeJson(
    KEYS.reminders,
    listMeetingReminders().filter((r) => r.id !== id)
  );
}

export function listBroadcasts(): StaffBroadcast[] {
  return readJson<StaffBroadcast[]>(KEYS.broadcasts, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function sendBroadcast(input: {
  title: string;
  body: string;
  audience: "REFERENTS" | "ALL";
  createdById: string;
  createdByName: string;
}): Promise<StaffBroadcast> {
  const row: StaffBroadcast = {
    id: uid(),
    title: input.title.trim(),
    body: input.body.trim(),
    audience: input.audience,
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt: new Date().toISOString(),
  };
  writeJson(KEYS.broadcasts, [row, ...listBroadcasts()]);
  const accounts = await listAllAccounts();
  const ids = accounts
    .filter((a) => {
      if (a.status !== "APPROVED") return false;
      if (a.userId === input.createdById) return false;
      const def = getGradeDef(normalizeGrade(a.grade));
      if (input.audience === "ALL") return def.kind !== "GAMEMASTER" || granted(def, "staffTools");
      return def.kind === "REFERENT" || def.kind === "DEV";
    })
    .map((a) => a.userId);
  pushNotifications(ids, {
    type: "broadcast",
    title: row.title,
    body: row.body,
    href: "/dashboard",
  });
  logActivity({
    action: "broadcast.sent",
    details: row.title,
    actorId: row.createdById,
    actorName: row.createdByName,
  });
  return row;
}

export function listWarnings(): StaffWarning[] {
  return readJson<StaffWarning[]>(KEYS.warnings, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createWarning(input: {
  targetUserId: string;
  targetName: string;
  reason: string;
  createdById: string;
  createdByName: string;
}): StaffWarning {
  const row: StaffWarning = {
    id: uid(),
    targetUserId: input.targetUserId,
    targetName: input.targetName,
    reason: input.reason.trim(),
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt: new Date().toISOString(),
  };
  writeJson(KEYS.warnings, [row, ...listWarnings()]);
  pushNotifications([row.targetUserId], {
    type: "warning",
    title: "Avertissement",
    body: row.reason,
    href: "/dashboard/profil",
  });
  logActivity({
    action: "warning.issued",
    details: `${row.targetName} · ${row.reason}`,
    actorId: row.createdById,
    actorName: row.createdByName,
  });
  return row;
}

export function deleteWarning(id: string) {
  writeJson(
    KEYS.warnings,
    listWarnings().filter((w) => w.id !== id)
  );
}

export function warningsForUser(userId: string) {
  return listWarnings().filter((w) => w.targetUserId === userId);
}

async function notifyReferents(payload: {
  type: string;
  title: string;
  body?: string;
  href?: string;
}) {
  const accounts = await listAllAccounts();
  const ids = accounts
    .filter((a) => {
      if (a.status !== "APPROVED") return false;
      const def = getGradeDef(normalizeGrade(a.grade));
      return def.kind === "REFERENT" || def.kind === "DEV";
    })
    .map((a) => a.userId);
  pushNotifications(ids, payload);
}
