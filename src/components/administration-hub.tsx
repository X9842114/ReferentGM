"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  canAccessBaremes,
  canAccessLeadTools,
  canAccessMeetingReports,
  canAccessStaffTools,
  canManageGrades,
  canOpenAdminHub,
  getGradeLabel,
  type GradeId,
} from "@/lib/permissions";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  Shield,
  ShieldBan,
  Table2,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type AdminLink = {
  href: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  allow: (grade: GradeId) => boolean;
};

const GROUPS: { label: string; items: AdminLink[] }[] = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/dashboard/supervision",
        title: "Supervision",
        hint: "Équipe, suivi, planning, messages",
        icon: Waypoints,
        allow: canAccessLeadTools,
      },
      {
        href: "/dashboard/activite",
        title: "Activité",
        hint: "Journal staff et export CSV",
        icon: Activity,
        allow: canAccessLeadTools,
      },
      {
        href: "/dashboard/rapports",
        title: "Rapports",
        hint: "Activité de l’équipe et notes de réunion",
        icon: ClipboardList,
        allow: canAccessMeetingReports,
      },
    ],
  },
  {
    label: "Économie",
    items: [
      {
        href: "/dashboard/baremes",
        title: "Barèmes",
        hint: "Grilles Or Rouge / Or Bleu",
        icon: Table2,
        allow: canAccessBaremes,
      },
      {
        href: "/dashboard/tableaux",
        title: "Tableaux",
        hint: "Récompenses GM et marché noir",
        icon: FileSpreadsheet,
        allow: canAccessBaremes,
      },
      {
        href: "/dashboard/marche-or",
        title: "Marché Or",
        hint: "Cumuls hebdo et thèmes",
        icon: Coins,
        allow: canAccessStaffTools,
      },
    ],
  },
  {
    label: "Rôles",
    items: [
      {
        href: "/dashboard/grades",
        title: "Grades",
        hint: "Créer, modifier et assigner",
        icon: Shield,
        allow: canManageGrades,
      },
    ],
  },
  {
    label: "Modération",
    items: [
      {
        href: "/dashboard/blacklist",
        title: "Blacklist",
        hint: "Sanctions GameMaster",
        icon: ShieldBan,
        allow: canAccessStaffTools,
      },
      {
        href: "/dashboard/reglements",
        title: "Règlements",
        hint: "Documents internes",
        icon: BookOpen,
        allow: canOpenAdminHub,
      },
    ],
  },
];

function DiscordLogStatus() {
  const [status, setStatus] = useState<{
    bot: boolean;
    logs: boolean;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/discord/events")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;
  const ok = status.bot && status.logs;

  return (
    <p className="text-sm text-white/40">
      Logs Discord ·{" "}
      <span className={ok ? "text-violet-300" : "text-amber-200"}>
        {ok ? "actifs" : !status.bot ? "bot non configuré" : "salon manquant"}
      </span>
    </p>
  );
}

export function AdministrationHub() {
  const { grade } = useAccount();
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((l) => l.allow(grade)),
  })).filter((g) => g.items.length > 0);

  return (
    <StaffPageShell title="Administration" description={getGradeLabel(grade)}>
      <DiscordLogStatus />
      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-sm font-medium text-white/50">{group.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rg-card group flex items-start gap-4 p-5 hover:border-violet-400/35"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-violet-400/15 text-violet-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {item.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/25 group-hover:text-violet-400" />
                    </span>
                    <span className="mt-1 block text-xs text-white/45">
                      {item.hint}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </StaffPageShell>
  );
}
