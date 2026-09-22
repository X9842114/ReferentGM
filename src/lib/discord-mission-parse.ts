import { listRpGroups, type RpGroupOption } from "@/lib/rp-groups";
import { listGmCells, type GmCell } from "@/lib/gm-cells";

export type ParsedDiscordMission = {
  title: string;
  description: string;
  duration: string;
  rewards: string;
  groupRaw: string;
  groups: RpGroupOption[];
  unmatchedGroups: string[];
  gmNames: string[];
  cells: { id: string; groupName: string; leadName: string | null }[];
};

type FieldKey = "title" | "description" | "duration" | "rewards" | "groups";

const FIELD_LABELS: Record<FieldKey, string[]> = {
  title: [
    "nom de la mission",
    "nom mission",
    "nom dela mission",
    "titre de la mission",
    "titre",
    "mission",
  ],
  description: [
    "description",
    "descriptif",
    "resume",
    "details",
    "detail",
    "contexte",
  ],
  duration: [
    "duree estimee",
    "duree estimer",
    "duree estime",
    "temps estime",
    "duree",
    "timing",
    "temps",
  ],
  rewards: [
    "recompenses",
    "recompense",
    "recompence",
    "recompances",
    "loot",
    "prime",
    "or",
  ],
  groups: [
    "groupes",
    "groupe",
    "group",
    "faction",
    "factions",
    "orga",
    "gang",
    "pf",
  ],
};

const EMOJI_FIELD: Record<string, FieldKey> = {
  "🎯": "title",
  "📝": "description",
  "⏳": "duration",
  "💰": "rewards",
  "👪": "groups",
  "👥": "groups",
  "👤": "groups",
};

const EXTRA_ALIASES: Record<string, string> = {
  bho: "1731",
  "black hood": "1731",
  "black hood order": "1731",
  gpf: "1096",
  wbs: "2377",
  "w.b.s": "2377",
  wh: "2621",
  "white hacker": "2621",
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acronym(name: string) {
  return name
    .split(/[\s/_-]+/)
    .filter((part) => part.length > 0 && !/^(de|des|du|la|le|les|the)$/i.test(part))
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? diag : Math.min(diag, prev[j], prev[j - 1]) + 1;
      diag = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.max(a.length, b.length) === 0
      ? 1
      : Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.15;
  }
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function classifyLabel(rawLabel: string): FieldKey | null {
  const emojiKey = Object.keys(EMOJI_FIELD).find((emoji) =>
    rawLabel.includes(emoji)
  );
  const folded = fold(
    rawLabel.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
  );
  if (!folded && emojiKey) return EMOJI_FIELD[emojiKey];

  let best: { key: FieldKey; score: number } | null = null;
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    for (const label of FIELD_LABELS[key]) {
      const score = similarity(folded, fold(label));
      if (!best || score > best.score) best = { key, score };
    }
  }

  if (best && best.score >= 0.62) return best.key;
  if (emojiKey) return EMOJI_FIELD[emojiKey];
  return null;
}

function splitHeader(line: string): { label: string; value: string } | null {
  const cleaned = line
    .replace(/[\uFE0F\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
  if (!cleaned) return null;
  const colon = cleaned.search(/[:：]/);
  if (colon < 0) return null;
  return {
    label: cleaned.slice(0, colon).trim(),
    value: cleaned.slice(colon + 1).trim(),
  };
}

function parseBlocks(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: { key: FieldKey; start: number; first: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const header = splitHeader(lines[i]);
    if (!header) continue;
    const key = classifyLabel(header.label);
    if (!key) continue;
    blocks.push({ key, start: i, first: header.value });
  }

  const fields: Record<FieldKey, string> = {
    title: "",
    description: "",
    duration: "",
    rewards: "",
    groups: "",
  };

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const end = blocks[b + 1]?.start ?? lines.length;
    const extra = lines
      .slice(block.start + 1, end)
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
    const value = [block.first, extra].filter(Boolean).join("\n").trim();
    if (value && !fields[block.key]) fields[block.key] = value;
  }

  return fields;
}

function splitGroupTokens(raw: string) {
  return raw
    .split(/\s*(?:,|;|\/|\||\bet\b|&)\s*/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchGroupToken(token: string): RpGroupOption | null {
  const needle = fold(token);
  if (!needle) return null;
  const aliasId = EXTRA_ALIASES[needle];
  const catalog = listRpGroups();
  if (aliasId) return catalog.find((g) => g.id === aliasId) ?? null;

  const scored = catalog.map((group) => {
    const name = fold(group.name);
    const acr = fold(acronym(group.name));
    const scores = [
      similarity(needle, name),
      similarity(needle, acr),
      needle.length >= 3 && name.includes(needle) ? 0.78 : 0,
      acr.length >= 2 && similarity(needle, acr) > 0.5 ? similarity(needle, acr) : 0,
    ];
    return { group, score: Math.max(...scores) };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  const min = needle.length <= 3 ? 0.72 : 0.58;
  return best.score >= min ? best.group : null;
}

function detectGroupsInText(text: string, already: RpGroupOption[]) {
  const found = [...already];
  const hay = fold(text);
  const catalog = listRpGroups();
  for (const group of catalog) {
    if (found.some((g) => g.id === group.id)) continue;
    const name = fold(group.name);
    const acr = fold(acronym(group.name));
    if ((name.length >= 5 && hay.includes(name)) || (acr.length >= 3 && hay.includes(acr))) {
      found.push(group);
    }
  }
  for (const [alias, id] of Object.entries(EXTRA_ALIASES)) {
    if (found.some((g) => g.id === id)) continue;
    if (hay.includes(alias)) {
      const group = catalog.find((g) => g.id === id);
      if (group) found.push(group);
    }
  }
  return found;
}

export function parseDiscordMissionPaste(raw: string): ParsedDiscordMission {
  const text = raw
    .replace(/[\u00a0\u2060\u200B-\u200D\uFEFF\uFE0F]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const fields = parseBlocks(text);

  const groups: RpGroupOption[] = [];
  const unmatchedGroups: string[] = [];
  for (const token of splitGroupTokens(fields.groups)) {
    const group = matchGroupToken(token);
    if (group && !groups.some((g) => g.id === group.id)) groups.push(group);
    else if (!group) unmatchedGroups.push(token);
  }

  const resolved = detectGroupsInText(text, groups);
  const linked = withLinkedGms({ groups: resolved });

  return {
    title: fields.title,
    description: fields.description,
    duration: fields.duration,
    rewards: fields.rewards,
    groupRaw: fields.groups,
    groups: resolved,
    unmatchedGroups,
    gmNames: linked.gmNames,
    cells: linked.cells,
  };
}

function cellMatchesGroup(cell: GmCell, group: RpGroupOption) {
  const cellFold = fold(cell.groupName);
  const nameFold = fold(group.name);
  const acr = fold(acronym(group.name));
  return (
    similarity(cellFold, nameFold) >= 0.72 ||
    similarity(cellFold, acr) >= 0.8 ||
    cellFold.includes(nameFold) ||
    nameFold.includes(cellFold)
  );
}

export function isUsefulDiscordParse(parsed: ParsedDiscordMission) {
  return Boolean(parsed.title || parsed.description || parsed.groups.length);
}

export const PARSE_SLOTS: { key: keyof Pick<ParsedDiscordMission, "title" | "description" | "duration" | "rewards"> | "groups"; label: string }[] = [
  { key: "title", label: "Mission" },
  { key: "description", label: "Description" },
  { key: "duration", label: "Durée" },
  { key: "rewards", label: "Récompenses" },
  { key: "groups", label: "Groupes" },
];

export function slotFilled(
  parsed: ParsedDiscordMission,
  key: (typeof PARSE_SLOTS)[number]["key"]
) {
  if (key === "groups") return parsed.groups.length > 0 || Boolean(parsed.groupRaw);
  return Boolean(parsed[key].trim());
}

export function rematchGroups(groupRaw: string, fallbackText = "") {
  const groups: RpGroupOption[] = [];
  const unmatchedGroups: string[] = [];
  for (const token of splitGroupTokens(groupRaw)) {
    const group = matchGroupToken(token);
    if (group && !groups.some((g) => g.id === group.id)) groups.push(group);
    else if (!group) unmatchedGroups.push(token);
  }
  return {
    groups: detectGroupsInText(fallbackText || groupRaw, groups),
    unmatchedGroups,
    groupRaw,
  };
}

export function withLinkedGms<T extends { groups: RpGroupOption[] }>(parsed: T) {
  const cells = listGmCells();
  const linkedCells = cells.filter((cell) =>
    parsed.groups.some((group) => cellMatchesGroup(cell, group))
  );
  const gmNames = [
    ...new Set(
      linkedCells.flatMap((cell) =>
        cell.members.map((member) => member.displayName).filter(Boolean)
      )
    ),
  ];
  return {
    ...parsed,
    gmNames,
    cells: linkedCells.map((cell) => ({
      id: cell.id,
      groupName: cell.groupName,
      leadName:
        cell.members.find((m) => m.cellRole === "PRINCIPAL")?.displayName ??
        null,
    })),
  };
}
