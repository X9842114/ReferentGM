import { kvRead, kvWrite } from "@/lib/app-kv";

export type GroupKind = "PF" | "GANG" | "ORGA";

export type RpGroupOption = {
  id: string;
  name: string;
  kind: GroupKind;
};

const GROUPS_KEY = "refgm.rp-groups.v1";
const GROUPS_EVENT = "refgm:rp-groups-updated";

/** Catalogue de départ — ensuite la liste vit dans le QG (ajouts / wipes). */
export const SEED_RP_GROUPS: RpGroupOption[] = [
  // PF
  { id: "1053", name: "Les ricains", kind: "PF" },
  { id: "1096", name: "GPF", kind: "PF" },
  { id: "1262", name: "Famille Kruguer", kind: "PF" },
  { id: "1417", name: "Muertenos", kind: "PF" },
  { id: "1494", name: "Shadow Knights", kind: "PF" },
  { id: "1499", name: "Strada Nostra", kind: "PF" },
  { id: "1589", name: "Obscyde", kind: "PF" },
  { id: "1646", name: "Devil's Sons", kind: "PF" },
  { id: "1731", name: "Black Hood Order", kind: "PF" },
  { id: "1820", name: "Epsilon", kind: "PF" },
  { id: "1869", name: "Lost verity", kind: "PF" },
  { id: "1874", name: "Foyer Compton", kind: "PF" },
  { id: "1993", name: "Famille Moni", kind: "PF" },
  { id: "2015", name: "Valley Side Mob", kind: "PF" },
  { id: "2017", name: "Opex", kind: "PF" },
  { id: "2161", name: "Street Drivers", kind: "PF" },
  { id: "2169", name: "La Mano Ombra", kind: "PF" },
  { id: "2260", name: "African Nation", kind: "PF" },
  { id: "2277", name: "Die Erben", kind: "PF" },
  { id: "2288", name: "Klan Ozumiya", kind: "PF" },
  { id: "13", name: "LA maja", kind: "PF" },
  { id: "2377", name: "W.B.S", kind: "PF" },
  { id: "2382", name: "VOLTA", kind: "PF" },
  { id: "2393", name: "Klan Zehkta", kind: "PF" },
  { id: "2436", name: "BWG", kind: "PF" },
  { id: "2569-nox", name: "Nox Reaepers Mc", kind: "PF" },
  { id: "2569-venta", name: "VenTa", kind: "PF" },
  { id: "2621", name: "WH / White Hacker", kind: "PF" },
  { id: "2633", name: "Black Diamond Society", kind: "PF" },

  // Gang
  { id: "2192", name: "Famillies", kind: "GANG" },
  { id: "2292", name: "Gorée 221", kind: "GANG" },
  { id: "2425", name: "Klan vellazeri", kind: "GANG" },
  { id: "2427", name: "M'5th HOOD", kind: "GANG" },
  { id: "2430", name: "fyli Tis Sykopetras", kind: "GANG" },
  { id: "2431", name: "Brooklyn BrotherHood", kind: "GANG" },
  { id: "2433", name: "Raijin", kind: "GANG" },
  { id: "2435", name: "Zhorta-krov", kind: "GANG" },
  { id: "2558", name: "Los malditos", kind: "GANG" },
  { id: "2559", name: "Los locos del Malecon", kind: "GANG" },

  // Orga
  { id: "1272", name: "Los reyes colombianos", kind: "ORGA" },
  { id: "1400", name: "Quarta corona", kind: "ORGA" },
  { id: "1475", name: "Rubi oscuro", kind: "ORGA" },
  { id: "1579", name: "Lonewolf MC", kind: "ORGA" },
  { id: "1745", name: "Bloodside", kind: "ORGA" },
  { id: "2238", name: "Mafia Kovak", kind: "ORGA" },
  { id: "2523", name: "La Fiera", kind: "ORGA" },
  { id: "2524", name: "Carles legado", kind: "ORGA" },
];

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  PF: "PF",
  GANG: "Gang",
  ORGA: "Orga",
};

/** Couleurs distinctes PF (bleu) / Gang (rose) / Orga (ambre) */
export const GROUP_KIND_CHIP: Record<GroupKind, string> = {
  PF: "border-sky-400/35 bg-sky-500/15 text-sky-100",
  GANG: "border-rose-400/35 bg-rose-500/15 text-rose-100",
  ORGA: "border-amber-400/35 bg-amber-500/15 text-amber-100",
};

export const GROUP_KIND_CHIP_IDLE: Record<GroupKind, string> = {
  PF: "border-sky-400/15 bg-sky-500/[0.04] text-sky-100/55 hover:bg-sky-500/10 hover:text-sky-50",
  GANG: "border-rose-400/15 bg-rose-500/[0.04] text-rose-100/55 hover:bg-rose-500/10 hover:text-rose-50",
  ORGA: "border-amber-400/15 bg-amber-500/[0.04] text-amber-100/55 hover:bg-amber-500/10 hover:text-amber-50",
};

export const GROUP_KIND_TAB: Record<GroupKind | "ALL", string> = {
  ALL: "border-white/20 bg-white text-[#0a0a0b]",
  PF: "border-sky-300/50 bg-sky-400 text-[#041018]",
  GANG: "border-rose-300/50 bg-rose-400 text-[#1a0508]",
  ORGA: "border-amber-300/50 bg-amber-400 text-[#1a1204]",
};

export const GROUP_KIND_TAB_IDLE: Record<GroupKind | "ALL", string> = {
  ALL: "border-white/10 bg-white/[0.04] text-white/45 hover:text-white",
  PF: "border-sky-400/20 bg-sky-500/[0.06] text-sky-200/70 hover:text-sky-100",
  GANG: "border-rose-400/20 bg-rose-500/[0.06] text-rose-200/70 hover:text-rose-100",
  ORGA: "border-amber-400/20 bg-amber-500/[0.06] text-amber-200/70 hover:text-amber-100",
};

export const GROUP_KIND_TEXT: Record<GroupKind, string> = {
  PF: "text-sky-300",
  GANG: "text-rose-300",
  ORGA: "text-amber-300",
};

export const GROUP_KIND_FILTERS = ["ALL", "PF", "GANG", "ORGA"] as const;
export type GroupKindFilter = (typeof GROUP_KIND_FILTERS)[number];

function asKind(value: unknown): GroupKind {
  return value === "PF" || value === "ORGA" ? value : "GANG";
}

function normalizeGroup(row: unknown): RpGroupOption | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Partial<RpGroupOption>;
  const id = String(rec.id ?? "").trim();
  const name = String(rec.name ?? "").trim();
  if (!id || !name) return null;
  return { id, name, kind: asKind(rec.kind) };
}

function sortGroups(rows: RpGroupOption[]) {
  return [...rows].sort((a, b) => {
    if (a.kind !== b.kind) {
      const order = { PF: 0, GANG: 1, ORGA: 2 };
      return order[a.kind] - order[b.kind];
    }
    return a.name.localeCompare(b.name, "fr");
  });
}

export function listRpGroups(): RpGroupOption[] {
  const stored = kvRead<unknown>(GROUPS_KEY, null);
  if (stored == null || !Array.isArray(stored)) {
    return sortGroups(SEED_RP_GROUPS.map((g) => ({ ...g })));
  }
  return sortGroups(
    stored.map(normalizeGroup).filter((g): g is RpGroupOption => Boolean(g))
  );
}

/** Compat lecture : toujours la liste live. */
export const RP_GROUPS: RpGroupOption[] = SEED_RP_GROUPS;

export function findRpGroup(id: string) {
  return listRpGroups().find((g) => g.id === id) ?? null;
}

export function resolveRpGroup(idOrName: string) {
  const q = idOrName.trim();
  if (!q) return null;
  const groups = listRpGroups();
  return (
    groups.find((g) => g.id === q) ??
    groups.find((g) => g.name.toLowerCase() === q.toLowerCase()) ??
    null
  );
}

export function liveGroupName(id: string, fallback = "") {
  return findRpGroup(id)?.name || fallback;
}

export function groupsByKind(kind: GroupKind) {
  return listRpGroups().filter((g) => g.kind === kind);
}

export function addRpGroup(input: {
  name: string;
  kind: GroupKind;
  id?: string;
}): RpGroupOption {
  const name = input.name.trim();
  if (!name) throw new Error("Indique le nom du groupe.");
  const id =
    (input.id ?? "").trim() ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    crypto.randomUUID();
  const current = listRpGroups();
  if (current.some((g) => g.id === id)) {
    throw new Error("Cet identifiant existe déjà.");
  }
  if (current.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Ce groupe est déjà dans la liste.");
  }
  const row: RpGroupOption = { id, name, kind: input.kind };
  kvWrite(GROUPS_KEY, sortGroups([...current, row]), GROUPS_EVENT);
  return row;
}

export function updateRpGroup(
  id: string,
  patch: { name?: string; kind?: GroupKind; newId?: string }
): RpGroupOption {
  const current = listRpGroups();
  const index = current.findIndex((g) => g.id === id);
  if (index < 0) throw new Error("Groupe introuvable.");

  const prev = current[index];
  const name = (patch.name ?? prev.name).trim();
  if (!name) throw new Error("Indique le nom du groupe.");

  const nextId = (patch.newId ?? prev.id).trim();
  if (!nextId) throw new Error("Indique l’identifiant.");

  if (
    nextId !== prev.id &&
    current.some((g) => g.id === nextId)
  ) {
    throw new Error("Cet identifiant existe déjà.");
  }
  if (
    current.some(
      (g) => g.id !== prev.id && g.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error("Ce nom est déjà pris.");
  }

  const row: RpGroupOption = {
    id: nextId,
    name,
    kind: patch.kind ?? prev.kind,
  };
  const next = [...current];
  next[index] = row;
  kvWrite(GROUPS_KEY, sortGroups(next), GROUPS_EVENT);
  return row;
}

export function removeRpGroup(id: string) {
  kvWrite(
    GROUPS_KEY,
    listRpGroups().filter((g) => g.id !== id),
    GROUPS_EVENT
  );
}
