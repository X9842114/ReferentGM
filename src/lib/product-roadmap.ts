import { kvRead, kvWrite } from "@/lib/app-kv";

export type RoadmapKind = "patch" | "wip" | "upcoming";
export type RoadmapVoteChoice = "yes" | "no";

export type RoadmapVote = {
  userId: string;
  userName: string;
  choice: RoadmapVoteChoice;
  at: string;
};

export type RoadmapEntry = {
  id: string;
  kind: RoadmapKind;
  title: string;
  body: string;
  version: string;
  progress: number;
  authorId: string;
  authorName: string;
  votes: RoadmapVote[];
  createdAt: string;
  updatedAt: string;
};

const KEY = "refgm.product-roadmap.v1";

export const ROADMAP_KIND_LABEL: Record<RoadmapKind, string> = {
  upcoming: "Proposé",
  wip: "En cours",
  patch: "Livré",
};

export const ROADMAP_KIND_ORDER: RoadmapKind[] = [
  "upcoming",
  "wip",
  "patch",
];

function readAll(): RoadmapEntry[] {
  const parsed = kvRead<RoadmapEntry[]>(KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalize);
}

function writeAll(rows: RoadmapEntry[]) {
  kvWrite(KEY, rows.slice(0, 200), "refgm:roadmap-updated");
}

function normalizeVotes(raw: unknown): RoadmapVote[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RoadmapVote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<RoadmapVote>;
    const userId = String(row.userId ?? "").trim();
    if (!userId || seen.has(userId)) continue;
    const choice: RoadmapVoteChoice = row.choice === "no" ? "no" : "yes";
    seen.add(userId);
    out.push({
      userId,
      userName: String(row.userName ?? "").trim() || "Référent",
      choice,
      at: row.at || new Date().toISOString(),
    });
  }
  return out;
}

function normalize(row: Partial<RoadmapEntry> & { id: string }): RoadmapEntry {
  const kind: RoadmapKind =
    row.kind === "wip" || row.kind === "upcoming" ? row.kind : "patch";
  return {
    id: row.id,
    kind,
    title: (row.title ?? "").trim(),
    body: (row.body ?? "").trim(),
    version: (row.version ?? "").trim(),
    progress: Math.max(0, Math.min(100, Math.round(Number(row.progress) || 0))),
    authorId: (row.authorId ?? "").trim(),
    authorName: (row.authorName ?? "").trim(),
    votes: normalizeVotes(row.votes),
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.createdAt ?? new Date().toISOString(),
  };
}

export function listRoadmap(kind?: RoadmapKind) {
  const rows = readAll().sort((a, b) => {
    const kindDelta =
      ROADMAP_KIND_ORDER.indexOf(a.kind) - ROADMAP_KIND_ORDER.indexOf(b.kind);
    if (kindDelta !== 0) return kindDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return kind ? rows.filter((row) => row.kind === kind) : rows;
}

export function roadmapVoteCounts(entry: RoadmapEntry) {
  const yes = entry.votes.filter((v) => v.choice === "yes").length;
  const no = entry.votes.filter((v) => v.choice === "no").length;
  return { yes, no, total: yes + no };
}

export function saveRoadmapEntry(input: {
  id?: string;
  kind: RoadmapKind;
  title: string;
  body: string;
  version?: string;
  progress?: number;
  authorId?: string;
  authorName?: string;
}): RoadmapEntry | null {
  const title = input.title.trim();
  if (!title) return null;
  const now = new Date().toISOString();
  const rows = readAll();
  if (input.id) {
    const next = rows.map((row) =>
      row.id === input.id
        ? normalize({
            ...row,
            ...input,
            title,
            votes: row.votes,
            updatedAt: now,
          })
        : row
    );
    const saved = next.find((row) => row.id === input.id);
    if (!saved) return null;
    writeAll(next);
    return saved;
  }
  const row = normalize({
    id: crypto.randomUUID(),
    kind: input.kind,
    title,
    body: input.body,
    version: input.version,
    progress:
      input.progress ??
      (input.kind === "patch" ? 100 : input.kind === "wip" ? 20 : 0),
    authorId: input.authorId,
    authorName: input.authorName,
    votes: [],
    createdAt: now,
    updatedAt: now,
  });
  writeAll([row, ...rows]);
  return row;
}

export function voteRoadmapEntry(
  id: string,
  voter: { userId: string; userName: string },
  choice: RoadmapVoteChoice
): RoadmapEntry | null {
  const userId = voter.userId.trim();
  if (!userId) return null;
  const now = new Date().toISOString();
  const rows = readAll();
  let saved: RoadmapEntry | null = null;
  const next = rows.map((row) => {
    if (row.id !== id) return row;
    const votes = row.votes.filter((vote) => vote.userId !== userId);
    votes.push({
      userId,
      userName: voter.userName.trim() || "Référent",
      choice,
      at: now,
    });
    saved = normalize({ ...row, votes, updatedAt: now });
    return saved;
  });
  if (!saved) return null;
  writeAll(next);
  return saved;
}

export function deleteRoadmapEntry(id: string) {
  writeAll(readAll().filter((row) => row.id !== id));
}

export function siteProgress(rows: RoadmapEntry[]) {
  const live = rows.filter((row) => row.kind !== "upcoming");
  if (!live.length) return 0;
  const sum = live.reduce(
    (n, r) => n + (r.kind === "patch" ? 100 : r.progress),
    0
  );
  return Math.round(sum / live.length);
}

const SEED: Omit<RoadmapEntry, "id" | "createdAt" | "updatedAt">[] = [
  {
    kind: "wip",
    title: "Planning mensuel + assignation",
    body: "Vue mois, profils Discord, glisser-déposer, priorités.",
    version: "",
    progress: 80,
    authorId: "",
    authorName: "",
    votes: [],
  },
  {
    kind: "upcoming",
    title: "Annuaire référents enrichi",
    body: "Fiches plus riches, grades et présence Discord.",
    version: "",
    progress: 0,
    authorId: "",
    authorName: "",
    votes: [],
  },
  {
    kind: "patch",
    title: "QG accueil + missions",
    body: "Profil Discord, noter une mission, suivi groupes.",
    version: "1.0",
    progress: 100,
    authorId: "",
    authorName: "",
    votes: [],
  },
];

export function ensureRoadmapSeed() {
  if (readAll().length) return;
  const now = new Date().toISOString();
  writeAll(
    SEED.map((row) =>
      normalize({
        ...row,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      })
    )
  );
}
