import type { GroupRewardEntry } from "@/lib/group-reward-log";
import { recapGroupRewards } from "@/lib/group-reward-log";
import { findRpGroup } from "@/lib/rp-groups";

export function downloadCsv(filename: string, table: (string | number | null | undefined)[][]) {
  const body = table
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
          return value;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSuiviCsv(
  rows: GroupRewardEntry[],
  filename = "suivi-groupes.csv"
) {
  const recap = recapGroupRewards(rows);
  const table: (string | number)[][] = [
    ["Export suivi groupes RefGM"],
    ["Missions", recap.count],
    ["Or bleu", recap.bleu],
    ["Or rouge", recap.rouge],
    ["Or total", recap.bleu + recap.rouge],
    ["Groupes", recap.byGroup.length],
    ["GameMasters", recap.byGm.length],
    [],
    ["Groupes missionnés"],
    ["Groupe", "ID", "Kind", "Missions", "Or bleu", "Or rouge", "Total", "Dernier GM", "Dernière date"],
    ...recap.byGroup.map((g) => {
      const catalog = findRpGroup(g.groupId);
      return [
        g.groupName,
        g.groupId,
        catalog?.kind ?? "",
        g.count,
        g.bleu,
        g.rouge,
        g.bleu + g.rouge,
        g.lastGm,
        g.lastAt,
      ];
    }),
    [],
    ["GameMasters"],
    ["GM", "Missions", "Or bleu", "Or rouge", "Total"],
    ...recap.byGm.map((g) => [
      g.gmName,
      g.count,
      g.bleu,
      g.rouge,
      g.bleu + g.rouge,
    ]),
    [],
    ["Missions"],
    [
      "Date",
      "Heure",
      "Mission",
      "Groupe",
      "ID groupe",
      "GM",
      "Couleur or",
      "Montant",
      "Note",
      "Référent",
    ],
    ...rows.map((row) => [
      row.missionDate,
      row.startTime,
      row.missionTitle,
      row.groupName,
      row.groupId,
      row.gmName,
      row.color,
      row.amount,
      row.rewardNote || row.suivi,
      row.loggedByName,
    ]),
  ];
  downloadCsv(filename, table);
}

export function downloadGmPeriodCsv(
  gmName: string,
  periodLabel: string,
  rows: GroupRewardEntry[]
) {
  const recap = recapGroupRewards(rows);
  downloadCsv(`gm-${slug(gmName)}.csv`, [
    ["Fiche GameMaster"],
    ["GM", gmName],
    ["Période", periodLabel],
    ["Missions", recap.count],
    ["Or bleu", recap.bleu],
    ["Or rouge", recap.rouge],
    ["Or total", recap.bleu + recap.rouge],
    ["Groupes", recap.byGroup.length],
    [],
    ["Groupes missionnés"],
    ["Groupe", "ID", "Kind", "Missions", "Or bleu", "Or rouge", "Total", "Dernière date"],
    ...recap.byGroup.map((g) => {
      const catalog = findRpGroup(g.groupId);
      return [
        g.groupName,
        g.groupId,
        catalog?.kind ?? "",
        g.count,
        g.bleu,
        g.rouge,
        g.bleu + g.rouge,
        g.lastAt,
      ];
    }),
    [],
    ["Missions"],
    [
      "Date",
      "Heure",
      "Mission",
      "Groupe",
      "ID groupe",
      "Couleur or",
      "Montant",
      "Note",
      "Référent",
    ],
    ...rows.map((row) => [
      row.missionDate,
      row.startTime,
      row.missionTitle,
      row.groupName,
      row.groupId,
      row.color,
      row.amount,
      row.rewardNote || row.suivi,
      row.loggedByName,
    ]),
  ]);
}

export function downloadAnalyticsCsv(input: {
  rangeLabel: string;
  kpis: Record<string, string | number>;
  missionTimeline: { label: string; created: number; approved: number; rejected: number }[];
  orCumulative: { label: string; bleu: number; rouge: number; total?: number }[];
  topGms: {
    name: string;
    missions: number;
    approved: number;
    pending?: number;
    orTotal: number;
    orBleu: number;
    orRouge: number;
  }[];
  topGmGroups: {
    name: string;
    missions: number;
    approved: number;
    orBleu: number;
    orRouge: number;
  }[];
  rewards: GroupRewardEntry[];
}) {
  downloadCsv("statistiques-refgm.csv", [
    ["Statistiques RefGM"],
    ["Période", input.rangeLabel],
    [],
    ["Indicateurs"],
    ["Clé", "Valeur"],
    ...Object.entries(input.kpis),
    [],
    ["Courbe missions"],
    ["Jour", "Créées", "Validées", "Refusées"],
    ...input.missionTimeline.map((d) => [d.label, d.created, d.approved, d.rejected]),
    [],
    ["Courbe or"],
    ["Jour", "Bleu", "Rouge", "Total"],
    ...input.orCumulative.map((d) => [
      d.label,
      d.bleu,
      d.rouge,
      d.total ?? d.bleu + d.rouge,
    ]),
    [],
    ["GameMasters"],
    ["GM", "Missions", "Validées", "Attente", "Or", "Bleu", "Rouge"],
    ...input.topGms.map((g) => [
      g.name,
      g.missions,
      g.approved,
      g.pending ?? "",
      g.orTotal,
      g.orBleu,
      g.orRouge,
    ]),
    [],
    ["Groupes"],
    ["Groupe", "Missions", "Validées", "Or bleu", "Or rouge"],
    ...input.topGmGroups.map((g) => [
      g.name,
      g.missions,
      g.approved,
      g.orBleu,
      g.orRouge,
    ]),
    [],
    ["Suivi groupes (toutes les lignes)"],
    [
      "Date",
      "Heure",
      "Mission",
      "Groupe",
      "GM",
      "Couleur",
      "Montant",
      "Note",
      "Référent",
    ],
    ...input.rewards.map((row) => [
      row.missionDate,
      row.startTime,
      row.missionTitle,
      row.groupName,
      row.gmName,
      row.color,
      row.amount,
      row.rewardNote || row.suivi,
      row.loggedByName,
    ]),
  ]);
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || "export"
  );
}
