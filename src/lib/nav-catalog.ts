import {
  canAccessActivite,
  canAccessAvancement,
  canAccessHome,
  canAccessLeadTools,
  canAccessMeetingReports,
  canAccessMissionsGm,
  canAccessPlanning,
  canAccessStatistics,
  canAccessSuiviGroupes,
  canAccessTrames,
  canBrowseGroups,
  canManageGameMasters,
  canManageGrades,
  canVerifyAccounts,
  canViewProfiles,
  type GradeId,
} from "@/lib/permissions";
import {
  emptyNavLayout,
  orderByIds,
  type NavLayout,
} from "@/lib/nav-layout";
import {
  Activity,
  Award,
  CalendarClock,
  ChartColumn,
  Coins,
  Crosshair,
  Eye,
  FileText,
  Gamepad2,
  House,
  IdCard,
  Landmark,
  ScrollText,
  TrendingUp,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItemDef = {
  href: string;
  label: string;
  icon: LucideIcon;
  defaultGroupId: string;
  visible: boolean;
  badge?: "pending";
};

export type NavGroupDef = {
  id: string;
  label: string;
  items: NavItemDef[];
};

export const DEFAULT_NAV_GROUPS: { id: string; label: string }[] = [
  { id: "qg", label: "QG" },
  { id: "equipe", label: "Équipe" },
  { id: "pilotage", label: "Pilotage" },
  { id: "roles", label: "Rôles" },
];

export function listNavCatalog(grade: GradeId): NavItemDef[] {
  const canSeePending = canVerifyAccounts(grade);
  return [
    {
      href: "/dashboard",
      label: "Accueil",
      icon: House,
      defaultGroupId: "qg",
      visible: canAccessHome(grade),
    },
    {
      href: "/dashboard/suivi-groupes",
      label: "Suivi groupes",
      icon: Coins,
      defaultGroupId: "qg",
      visible: canAccessSuiviGroupes(grade),
    },
    {
      href: "/dashboard/groupes",
      label: "Groupes",
      icon: Landmark,
      defaultGroupId: "qg",
      visible: canBrowseGroups(grade),
    },
    {
      href: "/dashboard/planning",
      label: "Planning",
      icon: CalendarClock,
      defaultGroupId: "qg",
      visible: canAccessPlanning(grade),
    },
    {
      href: "/dashboard/trames",
      label: "Trames",
      icon: ScrollText,
      defaultGroupId: "qg",
      visible: canAccessTrames(grade),
    },
    {
      href: "/dashboard/avancement",
      label: "Avancement",
      icon: TrendingUp,
      defaultGroupId: "qg",
      visible: canAccessAvancement(grade),
    },
    {
      href: "/dashboard/referents",
      label: "Référents",
      icon: IdCard,
      defaultGroupId: "equipe",
      visible: canViewProfiles(grade),
    },
    {
      href: "/dashboard/gamemasters",
      label: "GameMasters",
      icon: Gamepad2,
      defaultGroupId: "equipe",
      visible: canManageGameMasters(grade),
    },
    {
      href: "/dashboard/missions-gm",
      label: "Missions GM",
      icon: Crosshair,
      defaultGroupId: "equipe",
      visible: canAccessMissionsGm(grade),
    },
    {
      href: "/dashboard/validation",
      label: "Validation",
      icon: UserRoundCheck,
      defaultGroupId: "equipe",
      visible: canSeePending,
      badge: "pending" as const,
    },
    {
      href: "/dashboard/supervision",
      label: "Supervision",
      icon: Eye,
      defaultGroupId: "pilotage",
      visible: canAccessLeadTools(grade),
    },
    {
      href: "/dashboard/activite",
      label: "Activité",
      icon: Activity,
      defaultGroupId: "pilotage",
      visible: canAccessActivite(grade),
    },
    {
      href: "/dashboard/rapports",
      label: "Rapports",
      icon: FileText,
      defaultGroupId: "pilotage",
      visible: canAccessMeetingReports(grade),
    },
    {
      href: "/dashboard/statistiques",
      label: "Statistiques",
      icon: ChartColumn,
      defaultGroupId: "pilotage",
      visible: canAccessStatistics(grade),
    },
    {
      href: "/dashboard/grades",
      label: "Grades",
      icon: Award,
      defaultGroupId: "roles",
      visible: canManageGrades(grade),
    },
  ].filter((item) => item.visible);
}

export function groupLabel(id: string, layout: NavLayout) {
  if (layout.groupLabels[id]) return layout.groupLabels[id];
  const custom = layout.customGroups.find((group) => group.id === id);
  if (custom) return custom.label;
  return DEFAULT_NAV_GROUPS.find((group) => group.id === id)?.label ?? id;
}

export function applyNavLayout(
  catalog: NavItemDef[],
  layout: NavLayout,
  options?: { includeHidden?: boolean }
): NavGroupDef[] {
  const includeHidden = Boolean(options?.includeHidden);
  const hidden = new Set(layout.hidden);
  const groupMeta = [
    ...DEFAULT_NAV_GROUPS,
    ...layout.customGroups,
  ];
  const knownIds = new Set(groupMeta.map((group) => group.id));

  const buckets = new globalThis.Map<string, NavItemDef[]>();
  for (const meta of groupMeta) buckets.set(meta.id, []);

  for (const item of catalog) {
    if (!includeHidden && hidden.has(item.href)) continue;
    const assigned = layout.itemGroup[item.href];
    const home =
      item.href === "/dashboard/missions-gm" && (!assigned || assigned === "qg")
        ? item.defaultGroupId
        : assigned ?? item.defaultGroupId;
    const groupId = knownIds.has(home) ? home : item.defaultGroupId;
    const bucket = buckets.get(groupId) ?? [];
    bucket.push(item);
    buckets.set(groupId, bucket);
  }

  const orderedIds = orderByIds(
    groupMeta,
    layout.groupOrder,
    (group) => group.id
  ).map((group) => group.id);

  return orderedIds
    .map((id) => {
      const items = orderByIds(
        buckets.get(id) ?? [],
        layout.itemOrder[id] ?? [],
        (item) => item.href
      );
      return {
        id,
        label: groupLabel(id, layout),
        items,
      };
    })
    .filter((group) => includeHidden || group.items.length > 0);
}

export function ensureLayoutOrders(
  catalog: NavItemDef[],
  layout: NavLayout
): NavLayout {
  const groups = applyNavLayout(catalog, layout, { includeHidden: true });
  return {
    ...emptyNavLayout(),
    ...layout,
    groupOrder: groups.map((group) => group.id),
    itemOrder: Object.fromEntries(
      groups.map((group) => [group.id, group.items.map((item) => item.href)])
    ),
  };
}
