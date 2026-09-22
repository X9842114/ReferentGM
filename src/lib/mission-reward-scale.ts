/**
 * Barème officiel Flashback FA · Récompense GM Orga/Gang (Or Rouge)
 * Source: Google Sheet « FlashBack FA - Récompense GM Orga/Gang »
 */

export type MissionDurationId = "1h" | "1h30" | "2h" | "2h30" | "3h";

export type MissionSceneTypeId =
  | "PED"
  | "POLICE_PREVUE"
  | "POLICE_IMPREVUE";

export const MISSION_DURATIONS: {
  id: MissionDurationId;
  label: string;
}[] = [
  { id: "1h", label: "1h" },
  { id: "1h30", label: "1h30" },
  { id: "2h", label: "2h" },
  { id: "2h30", label: "2h30" },
  { id: "3h", label: "3h" },
];

export const MISSION_SCENE_TYPES: {
  id: MissionSceneTypeId;
  label: string;
  short: string;
  description: string;
  lootCompensation: string;
}[] = [
  {
    id: "PED",
    label: "PED × Groupe",
    short: "PED",
    description: "Une scène sans intervention policière.",
    lootCompensation: "X",
  },
  {
    id: "POLICE_PREVUE",
    label: "Police prévue × Groupe",
    short: "Police prévue",
    description:
      "Une scène dont l’intervention de la police est prévue de base (négociations, tirs…).",
    lootCompensation: "50%",
  },
  {
    id: "POLICE_IMPREVUE",
    label: "Police imprévue × Groupe",
    short: "Police imprévue",
    description:
      "Une scène PED × Groupe de base où la police intervient alors qu’elle n’était pas prévue.",
    lootCompensation: "50%",
  },
];

/** Or Rouge à donner au groupe (lingots) selon durée × type de scène */
export const ORGA_GANG_REWARD_GRID: Record<
  MissionDurationId,
  Record<MissionSceneTypeId, number>
> = {
  "1h": { PED: 60, POLICE_PREVUE: 100, POLICE_IMPREVUE: 87 },
  "1h30": { PED: 90, POLICE_PREVUE: 150, POLICE_IMPREVUE: 131 },
  "2h": { PED: 120, POLICE_PREVUE: 200, POLICE_IMPREVUE: 174 },
  "2h30": { PED: 150, POLICE_PREVUE: 250, POLICE_IMPREVUE: 218 },
  "3h": { PED: 180, POLICE_PREVUE: 300, POLICE_IMPREVUE: 261 },
};

export const REWARD_SCALE_NOTE =
  "Chaque récompense est en lingots d’or rouge : retirer le nombre du coffre et le donner directement au groupe. Faire jouer chaque groupe équitablement.";

/**
 * Barème PF (Or Bleu) · provisoire jusqu’au sheet officiel.
 * Structure alignée Orga/Gang (durée × type de scène).
 */
export const PF_REWARD_GRID: Record<
  MissionDurationId,
  Record<MissionSceneTypeId, number>
> = {
  "1h": { PED: 40, POLICE_PREVUE: 70, POLICE_IMPREVUE: 55 },
  "1h30": { PED: 60, POLICE_PREVUE: 105, POLICE_IMPREVUE: 85 },
  "2h": { PED: 80, POLICE_PREVUE: 140, POLICE_IMPREVUE: 115 },
  "2h30": { PED: 100, POLICE_PREVUE: 175, POLICE_IMPREVUE: 145 },
  "3h": { PED: 120, POLICE_PREVUE: 210, POLICE_IMPREVUE: 175 },
};

export const PF_REWARD_SCALE_NOTE =
  "Barème PF provisoire (Or Bleu). Remplacé dès réception du sheet officiel.";

export function lookupPfReward(
  duration: MissionDurationId,
  scene: MissionSceneTypeId,
): number {
  return PF_REWARD_GRID[duration][scene];
}

export function lookupOrgaGangReward(
  duration: MissionDurationId,
  scene: MissionSceneTypeId,
): number {
  return ORGA_GANG_REWARD_GRID[duration][scene];
}

export function lookupReward(
  kind: "ORGA" | "GANG" | "PF",
  duration: MissionDurationId,
  scene: MissionSceneTypeId,
): number {
  if (kind === "PF") return lookupPfReward(duration, scene);
  return lookupOrgaGangReward(duration, scene);
}

/** Flatten for DB seed / RewardGuideRow */
export function flattenOrgaGangGuideRows() {
  const rows: {
    kind: "ORGA" | "GANG";
    label: string;
    minOr: number;
    maxOr: number;
    notes: string;
    sortOrder: number;
  }[] = [];
  let order = 0;
  for (const kind of ["ORGA", "GANG"] as const) {
    for (const duration of MISSION_DURATIONS) {
      for (const scene of MISSION_SCENE_TYPES) {
        const amount = lookupOrgaGangReward(duration.id, scene.id);
        rows.push({
          kind,
          label: `${duration.label} · ${scene.short}`,
          minOr: amount,
          maxOr: amount,
          notes: `${scene.description} Compensation loot : ${scene.lootCompensation}`,
          sortOrder: order++,
        });
      }
    }
  }
  return rows;
}

export function flattenPfGuideRows() {
  const rows: {
    kind: "PF";
    label: string;
    minOr: number;
    maxOr: number;
    notes: string;
    sortOrder: number;
  }[] = [];
  let order = 0;
  for (const duration of MISSION_DURATIONS) {
    for (const scene of MISSION_SCENE_TYPES) {
      const amount = lookupPfReward(duration.id, scene.id);
      rows.push({
        kind: "PF",
        label: `${duration.label} · ${scene.short}`,
        minOr: amount,
        maxOr: amount,
        notes: `${scene.description} ${PF_REWARD_SCALE_NOTE}`,
        sortOrder: order++,
      });
    }
  }
  return rows;
}
