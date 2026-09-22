import { kvRead, kvWrite } from "@/lib/app-kv";
import { notifyDevelopers } from "@/lib/notifications";

export type DevFeedbackKind = "bug" | "amelioration";
export type DevFeedbackStatus = "OPEN" | "SEEN" | "DONE";

export type DevFeedback = {
  id: string;
  kind: DevFeedbackKind;
  title: string;
  body: string;
  page: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  status: DevFeedbackStatus;
  triagedAt: string | null;
  triagedBy: string | null;
};

const KEY = "refgm.dev-feedback.v1";

function readAll(): DevFeedback[] {
  const parsed = kvRead<DevFeedback[]>(KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(rows: DevFeedback[]) {
  kvWrite(KEY, rows.slice(0, 400), "refgm:dev-feedback-updated");
}

function uid() {
  return crypto.randomUUID();
}

export function listDevFeedback(): DevFeedback[] {
  return [...readAll()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listDevFeedbackForAuthor(authorId: string): DevFeedback[] {
  return listDevFeedback().filter((row) => row.authorId === authorId);
}

export function countOpenDevFeedback() {
  return listDevFeedback().filter((row) => row.status !== "DONE").length;
}

export async function createDevFeedback(input: {
  kind: DevFeedbackKind;
  title: string;
  body: string;
  page?: string;
  authorId: string;
  authorName: string;
}): Promise<DevFeedback | null> {
  const title = input.title.trim().slice(0, 160);
  const body = input.body.trim().slice(0, 4000);
  if (!input.authorId || !title || !body) return null;

  const row: DevFeedback = {
    id: uid(),
    kind: input.kind === "amelioration" ? "amelioration" : "bug",
    title,
    body,
    page: (input.page ?? "").trim().slice(0, 200),
    authorId: input.authorId,
    authorName: input.authorName.trim().slice(0, 80) || "Référent",
    createdAt: new Date().toISOString(),
    status: "OPEN",
    triagedAt: null,
    triagedBy: null,
  };
  writeAll([row, ...readAll()]);
  await notifyDevelopers({
    type: "dev-feedback",
    title:
      row.kind === "bug"
        ? `Bug signalé : ${row.title}`
        : `Idée : ${row.title}`,
    body: `${row.authorName} · ${row.body.slice(0, 180)}`,
    href: "/dashboard/signaler",
    excludeUserId: input.authorId,
  });
  return row;
}

export function setDevFeedbackStatus(
  id: string,
  status: DevFeedbackStatus,
  actorId: string
) {
  const all = readAll();
  const idx = all.findIndex((row) => row.id === id);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    status,
    triagedAt: new Date().toISOString(),
    triagedBy: actorId,
  };
  writeAll(all);
  return all[idx];
}
