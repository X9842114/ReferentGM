/** Stockage local des outils staff RefGM (business, blacklist, etc.). */

import { kvRead, kvWrite } from "@/lib/app-kv";

export type StaffBusiness = {
  id: string;
  name: string;
  description: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BlacklistEntry = {
  id: string;
  targetUserId: string;
  targetName: string;
  reason: string;
  active: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string | null;
};

export type RevendicationKind = "DROGUE" | "BUSINESS";

export type Revendication = {
  id: string;
  kind: RevendicationKind;
  label: string;
  blGl: "BL" | "GL" | null;
  typeLabel: string;
  holders: string[];
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  action: string;
  details: string;
  actorId: string | null;
  actorName: string;
  createdAt: string;
};

export type MeetingReport = {
  id: string;
  title: string;
  body: string;
  meetingAt: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type RuleDoc = {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy: string | null;
};

const KEYS = {
  business: "refgm.staff.business.v1",
  blacklist: "refgm.staff.blacklist.v1",
  revend: "refgm.staff.revendications.v1",
  activity: "refgm.staff.activity.v1",
  reports: "refgm.staff.rapports.v1",
  rules: "refgm.staff.reglements.v1",
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

export function logActivity(input: {
  action: string;
  details?: string;
  actorId?: string | null;
  actorName?: string;
}) {
  const entry: ActivityEntry = {
    id: uid(),
    action: input.action,
    details: input.details?.trim() || "",
    actorId: input.actorId ?? null,
    actorName: input.actorName?.trim() || "Système",
    createdAt: new Date().toISOString(),
  };
  const list = readJson<ActivityEntry[]>(KEYS.activity, []);
  writeJson(KEYS.activity, [entry, ...list].slice(0, 500));
  return entry;
}

export function listActivity(): ActivityEntry[] {
  return readJson<ActivityEntry[]>(KEYS.activity, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function exportActivityCsv(rows: ActivityEntry[]): string {
  const header = "date;acteur;acteurId;action;details";
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      JSON.stringify(r.actorName),
      JSON.stringify(r.actorId ?? ""),
      JSON.stringify(r.action),
      JSON.stringify(r.details),
    ].join(";")
  );
  return [header, ...lines].join("\n");
}

/* ——— Business ——— */
export function listBusinesses(): StaffBusiness[] {
  return readJson<StaffBusiness[]>(KEYS.business, []).sort((a, b) =>
    a.name.localeCompare(b.name, "fr")
  );
}

export function saveBusiness(
  input: Omit<StaffBusiness, "id" | "createdAt" | "updatedAt"> & { id?: string }
): StaffBusiness {
  const now = new Date().toISOString();
  const all = listBusinesses();
  if (input.id) {
    const idx = all.findIndex((b) => b.id === input.id);
    if (idx >= 0) {
      const next = { ...all[idx], ...input, updatedAt: now };
      all[idx] = next;
      writeJson(KEYS.business, all);
      return next;
    }
  }
  const created: StaffBusiness = {
    id: uid(),
    name: input.name.trim(),
    description: input.description.trim(),
    assigneeIds: input.assigneeIds,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(KEYS.business, [created, ...all]);
  return created;
}

export function deleteBusiness(id: string) {
  writeJson(
    KEYS.business,
    listBusinesses().filter((b) => b.id !== id)
  );
}

/* ——— Blacklist ——— */
export function listBlacklist(): BlacklistEntry[] {
  return readJson<BlacklistEntry[]>(KEYS.blacklist, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addBlacklist(input: {
  targetUserId: string;
  targetName: string;
  reason: string;
  createdBy: string;
  createdByName: string;
  expiresAt?: string | null;
}): BlacklistEntry {
  const entry: BlacklistEntry = {
    id: uid(),
    targetUserId: input.targetUserId,
    targetName: input.targetName,
    reason: input.reason.trim(),
    active: true,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };
  writeJson(KEYS.blacklist, [entry, ...listBlacklist()]);
  logActivity({
    action: "blacklist.added",
    details: `${entry.targetName} · ${entry.reason}`,
    actorId: input.createdBy,
    actorName: input.createdByName,
  });
  return entry;
}

export function setBlacklistActive(id: string, active: boolean) {
  const all = listBlacklist().map((e) =>
    e.id === id ? { ...e, active } : e
  );
  writeJson(KEYS.blacklist, all);
}

/* ——— Revendications ——— */
const DEFAULT_REVENDICATIONS: Omit<Revendication, "id" | "createdAt" | "updatedAt">[] = [
  { kind: "DROGUE", label: "Cocaïne", blGl: "BL", typeLabel: "ORGANISATION", holders: [] },
  { kind: "DROGUE", label: "Meth", blGl: "BL", typeLabel: "GANG", holders: [] },
  { kind: "DROGUE", label: "Weed", blGl: "GL", typeLabel: "GANG/ORGA", holders: [] },
  { kind: "BUSINESS", label: "Armurerie", blGl: null, typeLabel: "ORGANISATION", holders: [] },
  { kind: "BUSINESS", label: "Garage", blGl: null, typeLabel: "GANG", holders: [] },
];

export function listRevendications(): Revendication[] {
  const existing = readJson<Revendication[] | null>(KEYS.revend, null);
  if (existing && existing.length > 0) return existing;
  const now = new Date().toISOString();
  const seeded = DEFAULT_REVENDICATIONS.map((r) => ({
    ...r,
    id: uid(),
    createdAt: now,
    updatedAt: now,
  }));
  writeJson(KEYS.revend, seeded);
  return seeded;
}

export function saveRevendication(
  input: Omit<Revendication, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Revendication {
  const now = new Date().toISOString();
  const all = listRevendications();
  if (input.id) {
    const idx = all.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const next = { ...all[idx], ...input, updatedAt: now };
      all[idx] = next;
      writeJson(KEYS.revend, all);
      return next;
    }
  }
  const created: Revendication = {
    id: uid(),
    kind: input.kind,
    label: input.label.trim(),
    blGl: input.blGl,
    typeLabel: input.typeLabel.trim() || "ORGANISATION",
    holders: input.holders.map((h) => h.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
  };
  writeJson(KEYS.revend, [created, ...all]);
  return created;
}

export function deleteRevendication(id: string) {
  writeJson(
    KEYS.revend,
    listRevendications().filter((r) => r.id !== id)
  );
}

/* ——— Rapports ——— */
export function listReports(): MeetingReport[] {
  return readJson<MeetingReport[]>(KEYS.reports, []).sort(
    (a, b) => new Date(b.meetingAt).getTime() - new Date(a.meetingAt).getTime()
  );
}

export function saveReport(input: {
  id?: string;
  title: string;
  body: string;
  meetingAt: string;
  authorId: string;
  authorName: string;
}): MeetingReport {
  const all = listReports();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const next = { ...all[idx], ...input, title: input.title.trim(), body: input.body };
      all[idx] = next;
      writeJson(KEYS.reports, all);
      return next;
    }
  }
  const created: MeetingReport = {
    id: uid(),
    title: input.title.trim() || "Briefing",
    body: input.body,
    meetingAt: input.meetingAt || now,
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: now,
  };
  writeJson(KEYS.reports, [created, ...all]);
  logActivity({
    action: "rapport.created",
    details: created.title,
    actorId: input.authorId,
    actorName: input.authorName,
  });
  return created;
}

export function deleteReport(id: string) {
  writeJson(
    KEYS.reports,
    listReports().filter((r) => r.id !== id)
  );
}

/* ——— Règlements ——— */
export const RULE_DOCS: { slug: string; title: string; seed: string }[] = [
  {
    slug: "reglement-gm",
    title: "Règlement GameMaster",
    seed: "Règlement GameMaster\n\n1. Respecter l’équité entre groupes.\n2. Documenter les scènes et l’Or donné.\n3. Remonter les incidents aux référents.",
  },
  {
    slug: "reglement-referent",
    title: "Règlement Référents",
    seed: "Règlement Référents\n\n1. Valider comptes et missions dans les délais.\n2. Tenir à jour blacklist, business et revendications.\n3. Préparer les briefings Lead.",
  },
  {
    slug: "scene-ped",
    title: "Scène PED",
    seed: "Guide scène PED\n\n- Pas d’intervention police prévue.\n- Adapter le barème Or selon la durée.",
  },
  {
    slug: "mort-rp",
    title: "Mort RP",
    seed: "Règles Mort RP\n\n- Validation référent obligatoire.\n- Conséquences claires pour le personnage.",
  },
];

export function listRuleDocs(): RuleDoc[] {
  const stored = readJson<RuleDoc[] | null>(KEYS.rules, null);
  if (stored && stored.length > 0) return stored;
  const now = new Date().toISOString();
  const seeded = RULE_DOCS.map((r) => ({
    slug: r.slug,
    title: r.title,
    content: r.seed,
    updatedAt: now,
    updatedBy: null,
  }));
  writeJson(KEYS.rules, seeded);
  return seeded;
}

export function saveRuleDoc(input: {
  slug: string;
  content: string;
  updatedBy: string | null;
}): RuleDoc {
  const all = listRuleDocs();
  const idx = all.findIndex((d) => d.slug === input.slug);
  const meta = RULE_DOCS.find((r) => r.slug === input.slug);
  const next: RuleDoc = {
    slug: input.slug,
    title: meta?.title || input.slug,
    content: input.content,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeJson(KEYS.rules, all);
  return next;
}
