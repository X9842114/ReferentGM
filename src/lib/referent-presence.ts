export type ReferentPresencePeer = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  grade: string;
  path: string;
  at: number;
};

export const PRESENCE_STALE_MS = 50_000;

const PAGE_LABELS: [string, string][] = [
  ["/dashboard/suivi-groupes", "Suivi groupes"],
  ["/dashboard/missions-gm", "Missions GM"],
  ["/dashboard/gamemasters", "GameMasters"],
  ["/dashboard/referents", "Référents"],
  ["/dashboard/planning", "Planning"],
  ["/dashboard/trames", "Trames"],
  ["/dashboard/avancement", "Avancement"],
  ["/dashboard/validation", "Validation"],
  ["/dashboard/supervision", "Supervision"],
  ["/dashboard/activite", "Activité"],
  ["/dashboard/rapports", "Rapports"],
  ["/dashboard/statistiques", "Statistiques"],
  ["/dashboard/grades", "Grades"],
  ["/dashboard/groupes", "Groupes"],
  ["/dashboard/profil", "Profil"],
  ["/dashboard", "Accueil"],
];

export function presencePageLabel(path: string | null | undefined) {
  const value = path?.trim() || "/dashboard";
  const hit = PAGE_LABELS.find(([href]) =>
    href === "/dashboard" ? value === "/dashboard" : value.startsWith(href)
  );
  return hit?.[1] ?? "QG";
}

export function presenceAgo(at: number, now = Date.now()) {
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 20) return "à l’instant";
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.round(sec / 60);
  return `il y a ${min} min`;
}
