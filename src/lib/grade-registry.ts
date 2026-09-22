export type GradeKind = "REFERENT" | "GAMEMASTER" | "DEV";

export const PERMISSION_FLAGS = [
  { key: "fullAccess", label: "Accès total au QG", group: "Général" },

  { key: "accessHome", label: "Accueil", group: "QG" },
  { key: "accessSuiviGroupes", label: "Suivi groupes", group: "QG" },
  { key: "logGroupMissions", label: "Noter une mission", group: "QG" },
  { key: "accessGroupes", label: "Catalogue groupes", group: "QG" },
  { key: "browseGroups", label: "Parcourir / missionner un groupe", group: "QG" },
  { key: "manageGroups", label: "Créer / modifier / supprimer un groupe", group: "QG" },
  { key: "accessPlanning", label: "Planning", group: "QG" },
  { key: "managePlanning", label: "Créer et modifier le planning", group: "QG" },
  { key: "joinPlanning", label: "S’inscrire sur un créneau", group: "QG" },
  { key: "accessTrames", label: "Trames", group: "QG" },
  { key: "editTrames", label: "Modifier les trames", group: "QG" },
  { key: "accessAvancement", label: "Avancement / roadmap", group: "QG" },
  { key: "voteRoadmap", label: "Voter les propositions", group: "QG" },

  { key: "viewProfiles", label: "Voir les profils", group: "Équipe" },
  { key: "accessReferents", label: "Annuaire référents", group: "Équipe" },
  { key: "accessGamemasters", label: "Fiches GameMasters", group: "Équipe" },
  { key: "manageGamemasters", label: "Créer / modifier une cellule GM", group: "Équipe" },
  { key: "accessMissionsGm", label: "Missions GM (cellules)", group: "Équipe" },
  { key: "verifyAccounts", label: "Valider les comptes", group: "Équipe" },
  { key: "manageGrades", label: "Gérer les grades", group: "Équipe" },
  { key: "assignGrades", label: "Changer le grade d’un compte", group: "Équipe" },

  { key: "accessMissions", label: "Proposer une mission GM", group: "Missions" },
  { key: "readMissions", label: "Lire la file missions", group: "Missions" },
  { key: "validateMissions", label: "Valider / refuser une mission", group: "Missions" },
  { key: "accessMissionRules", label: "Règles de validation missions", group: "Missions" },
  { key: "accessAtelier", label: "Atelier scènes", group: "Missions" },
  { key: "accessPropositions", label: "Propositions / brouillons", group: "Missions" },

  { key: "giveRewards", label: "Donner de l’or", group: "Or" },
  { key: "accessRewards", label: "Voir les récompenses or", group: "Or" },
  { key: "accessMarcheOr", label: "Marché or", group: "Or" },
  { key: "accessBaremes", label: "Barèmes / tableaux", group: "Or" },
  { key: "reviewGiveRequests", label: "Traiter les demandes give", group: "Or" },
  { key: "accessDemandesGive", label: "File des demandes give", group: "Or" },

  { key: "accessSupervision", label: "Supervision", group: "Pilotage" },
  { key: "accessActivite", label: "Journal d’activité", group: "Pilotage" },
  { key: "accessRapports", label: "Rapports de réunion", group: "Pilotage" },
  { key: "accessStatistiques", label: "Statistiques", group: "Pilotage" },
  { key: "accessAdministration", label: "Hub administration", group: "Pilotage" },
  { key: "staffTools", label: "Outils staff", group: "Pilotage" },
  { key: "accessBlacklist", label: "Blacklist", group: "Pilotage" },
  { key: "accessBusiness", label: "Business", group: "Pilotage" },
  { key: "accessRevendications", label: "Revendications", group: "Pilotage" },
  { key: "accessReglements", label: "Règlements", group: "Pilotage" },
  { key: "editReglements", label: "Modifier les règlements", group: "Pilotage" },
  { key: "configureApp", label: "Configurer l’app", group: "Pilotage" },
  { key: "demoteSuperviseur", label: "Retirer un Superviseur", group: "Pilotage" },
  { key: "accessChat", label: "Chat équipe", group: "Pilotage" },
  { key: "sendBroadcasts", label: "Envoyer un broadcast", group: "Pilotage" },
  { key: "manageWarnings", label: "Avertissements", group: "Pilotage" },
  { key: "accessSignalements", label: "Signalements / idées", group: "Pilotage" },
  { key: "triageFeedback", label: "Trier les signalements", group: "Pilotage" },
] as const;

export type PermissionFlagKey = (typeof PERMISSION_FLAGS)[number]["key"];

export type GradeDef = {
  id: string;
  label: string;
  rank: number;
  color: string;
  kind: GradeKind;
  isSystem: boolean;
  isProtected: boolean;
} & Record<PermissionFlagKey, boolean>;

export function emptyPermissions(): Record<PermissionFlagKey, boolean> {
  return Object.fromEntries(
    PERMISSION_FLAGS.map(({ key }) => [key, false])
  ) as Record<PermissionFlagKey, boolean>;
}

export function fillPermissions(
  overrides: Partial<Record<PermissionFlagKey, boolean>> = {},
  fill = false
): Record<PermissionFlagKey, boolean> {
  return {
    ...emptyPermissions(),
    ...(fill
      ? Object.fromEntries(PERMISSION_FLAGS.map(({ key }) => [key, true]))
      : {}),
    ...overrides,
  } as Record<PermissionFlagKey, boolean>;
}

const HQ = fillPermissions({
  accessHome: true,
  accessSuiviGroupes: true,
  logGroupMissions: true,
  accessGroupes: true,
  browseGroups: true,
  manageGroups: true,
  accessPlanning: true,
  managePlanning: true,
  joinPlanning: true,
  accessTrames: true,
  editTrames: true,
  accessAvancement: true,
  voteRoadmap: true,
  viewProfiles: true,
  accessReferents: true,
  accessGamemasters: true,
  manageGamemasters: true,
  accessMissionsGm: true,
  accessMissions: true,
  readMissions: true,
  validateMissions: true,
  accessPropositions: true,
  accessStatistiques: true,
  accessAdministration: true,
  staffTools: true,
  accessChat: true,
  accessSignalements: true,
  accessDemandesGive: true,
  reviewGiveRequests: true,
});

const LEAD = fillPermissions({
  ...HQ,
  verifyAccounts: true,
  manageGrades: true,
  assignGrades: true,
  accessSupervision: true,
  accessActivite: true,
  accessRapports: true,
  accessMissionRules: true,
  accessAtelier: true,
  accessBaremes: true,
  accessMarcheOr: true,
  accessBlacklist: true,
  accessBusiness: true,
  accessRevendications: true,
  accessReglements: true,
  sendBroadcasts: true,
  manageWarnings: true,
  demoteSuperviseur: true,
});

const ALL = fillPermissions({ fullAccess: true }, true);

const GM = fillPermissions({
  accessMissions: true,
  giveRewards: true,
  accessRewards: true,
  browseGroups: true,
  viewProfiles: true,
  accessGroupes: true,
  joinPlanning: true,
});

/** Grades système — même hiérarchie qu’Admin-GameMaster */
export const SYSTEM_GRADE_DEFS: GradeDef[] = [
  {
    id: "DEVELOPPEUR",
    label: "Développeur",
    rank: -1,
    color: "#a78bfa",
    kind: "DEV",
    isSystem: true,
    isProtected: true,
    ...ALL,
  },
  {
    id: "SUPERVISEUR_GM",
    label: "Superviseur GameMaster",
    rank: 0,
    color: "#f59e0b",
    kind: "REFERENT",
    isSystem: true,
    isProtected: true,
    ...ALL,
    fullAccess: true,
  },
  {
    id: "RESPONSABLE",
    label: "Responsable",
    rank: 0,
    color: "#fb7185",
    kind: "REFERENT",
    isSystem: true,
    isProtected: true,
    ...LEAD,
    configureApp: true,
    editReglements: true,
    triageFeedback: false,
  },
  {
    id: "LEAD_REFERENT",
    label: "Lead Référent GameMaster",
    rank: 1,
    color: "#fbbf24",
    kind: "REFERENT",
    isSystem: true,
    isProtected: false,
    ...LEAD,
    editReglements: true,
  },
  {
    id: "CO_LEAD_REFERENT",
    label: "Co Lead Référent GameMaster",
    rank: 2,
    color: "#fcd34d",
    kind: "REFERENT",
    isSystem: true,
    isProtected: false,
    ...LEAD,
  },
  {
    id: "MANAGER_REFERENT",
    label: "Manager Référent GameMaster",
    rank: 3,
    color: "#38bdf8",
    kind: "REFERENT",
    isSystem: true,
    isProtected: false,
    ...HQ,
    verifyAccounts: true,
  },
  {
    id: "REFERENT_QUALIFIE",
    label: "Référent GameMaster Qualifié",
    rank: 4,
    color: "#34d399",
    kind: "REFERENT",
    isSystem: true,
    isProtected: false,
    ...HQ,
  },
  {
    id: "REFERENT",
    label: "Référent GameMaster",
    rank: 5,
    color: "#2dd4bf",
    kind: "REFERENT",
    isSystem: true,
    isProtected: false,
    ...HQ,
  },
  {
    id: "GAMEMASTER",
    label: "GameMaster",
    rank: 6,
    color: "#fb923c",
    kind: "GAMEMASTER",
    isSystem: true,
    isProtected: false,
    ...GM,
  },
];

let customGradeDefs: GradePatch[] = [];

export type GradePatch = {
  id: string;
  label?: string;
  rank?: number;
  color?: string;
  kind?: GradeKind;
  isSystem?: boolean;
  isProtected?: boolean;
} & Partial<Record<PermissionFlagKey, boolean>>;

export function mergeGradeCatalog(extra: GradePatch[]): GradeDef[] {
  const byId = new Map(
    SYSTEM_GRADE_DEFS.map((grade) => [grade.id, { ...grade }])
  );
  for (const grade of extra) {
    const id = grade.id.trim();
    if (!id || id === "DEVELOPPEUR") continue;
    const base = byId.get(id);
    const merged: GradeDef = {
      ...emptyPermissions(),
      ...(base ?? {
        id,
        label: grade.label || id,
        rank: grade.rank ?? 10,
        color: grade.color ?? "#38bdf8",
        kind: grade.kind ?? "REFERENT",
        isSystem: false,
        isProtected: false,
      }),
      id,
      label: grade.label?.trim() || base?.label || id,
      rank: Number.isFinite(grade.rank) ? Number(grade.rank) : base?.rank ?? 10,
      color: grade.color?.trim() || base?.color || "#38bdf8",
      kind: grade.kind ?? base?.kind ?? "REFERENT",
      isSystem: Boolean(base?.isSystem || grade.isSystem),
      isProtected: base ? base.isProtected : Boolean(grade.isProtected),
    };
    for (const { key } of PERMISSION_FLAGS) {
      if (Object.prototype.hasOwnProperty.call(grade, key)) {
        merged[key] = Boolean(grade[key]);
      }
    }
    byId.set(id, merged);
  }
  return [...byId.values()];
}

function allGradeDefs() {
  return mergeGradeCatalog(customGradeDefs);
}

/** Met à jour le catalogue chargé depuis Supabase dans le navigateur. */
export function setCustomGradeDefs(grades: GradePatch[]) {
  customGradeDefs = grades.filter(
    (grade) =>
      grade.id.trim().length > 0 &&
      (grade.label ?? "").trim().length > 0 &&
      grade.id !== "DEVELOPPEUR"
  );
}

export function getGradeDef(id: string): GradeDef {
  return (
    allGradeDefs().find((grade) => grade.id === id) || {
      ...SYSTEM_GRADE_DEFS.find((g) => g.id === "GAMEMASTER")!,
      id,
      label: id,
      isSystem: false,
    }
  );
}

export function granted(
  grade: string | GradeDef,
  key: PermissionFlagKey
): boolean {
  const def = typeof grade === "string" ? getGradeDef(grade) : grade;
  if (def.kind === "DEV" || def.id === "DEVELOPPEUR") return true;
  if (def.fullAccess) return true;
  return def[key] === true;
}

export function listGradeDefs(): GradeDef[] {
  return allGradeDefs().sort((a, b) => a.rank - b.rank);
}

export function gradeLabel(id: string): string {
  return getGradeDef(id).label;
}

export function isValidGradeId(id: string): boolean {
  return allGradeDefs().some((grade) => grade.id === id);
}

export function permissionGroups() {
  const groups: { title: string; flags: (typeof PERMISSION_FLAGS)[number][] }[] =
    [];
  for (const flag of PERMISSION_FLAGS) {
    const current = groups.find((group) => group.title === flag.group);
    if (current) current.flags.push(flag);
    else groups.push({ title: flag.group, flags: [flag] });
  }
  return groups;
}
