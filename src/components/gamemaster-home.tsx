"use client";

import { useAccount } from "@/components/account-context";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { HomeMissionLog } from "@/components/home-mission-log";
import { ProfileCard } from "@/components/profile-card";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { displayDiscordId } from "@/lib/cve-access";
import { getGradeDef } from "@/lib/grade-registry";
import { listGiveRequests } from "@/lib/give-requests";
import {
  canAccessGiveRequests,
  canAccessMissions,
  canReadMissions,
  getGradeLabel,
} from "@/lib/permissions";
import { defaultProfile, getProfile } from "@/lib/profile-storage";
import { listMissions, type StoredMission } from "@/lib/mission-storage";
import { ArrowRight, FilePenLine, Gift, PencilRuler, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const statuses = {
  draft: { label: "Brouillon", color: "bg-white/10 text-white/70" },
  pending_review: { label: "En validation", color: "bg-amber-400/10 text-amber-200" },
  approved: { label: "Validée", color: "bg-emerald-400/10 text-emerald-200" },
  rejected: { label: "Refusée", color: "bg-rose-400/10 text-rose-200" },
};

export function GameMasterHome({ userName }: { userName?: string | null }) {
  const { account, grade } = useAccount();
  const dashUser = useDashboardUser();
  const [missions, setMissions] = useState<StoredMission[]>([]);
  const [pendingGives, setPendingGives] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const canSeeMissions = canAccessMissions(grade) || canReadMissions(grade);
  const canSeeGives = canAccessGiveRequests(grade);
  const gradeDef = getGradeDef(grade);
  const gradeLabel = getGradeLabel(grade);

  useEffect(() => {
    const refresh = () => {
      setMissions(
        canSeeMissions
          ? listMissions().filter((mission) => mission.authorId === account.userId)
          : []
      );
      setPendingGives(
        canSeeGives
          ? listGiveRequests().filter(
              (request) =>
                request.requesterId === account.userId &&
                request.status === "PENDING"
            ).length
          : null
      );
      setReady(true);
    };
    refresh();
    const events = ["refgm:missions-updated", "refgm:staff-updated", "storage"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () =>
      events.forEach((event) => window.removeEventListener(event, refresh));
  }, [account.userId, canSeeMissions, canSeeGives]);

  const cards = [
    {
      label: "Brouillons",
      value: missions.filter((mission) => mission.status === "draft").length,
      href: "/dashboard/brouillons",
      visible: canSeeMissions,
    },
    {
      label: "En validation",
      value: missions.filter((m) => m.status === "pending_review").length,
      href: "/dashboard/missions",
      visible: canSeeMissions,
    },
    {
      label: "Validées",
      value: missions.filter((mission) => mission.status === "approved").length,
      href: "/dashboard/missions",
      visible: canSeeMissions,
    },
    {
      label: "Gives",
      value: pendingGives,
      href: "/dashboard/demandes-give",
      visible: canSeeGives,
    },
  ].filter((card) => card.visible);

  const display = defaultProfile({
    userId: account.userId,
    name: userName || account.displayName,
    image: dashUser.image || account.discordAvatarUrl,
    discordLinked: account.discordLinked || dashUser.discordLinked,
    discordId:
      dashUser.discordId ||
      (displayDiscordId(account.userId) || account.userId),
    bannerUrl: dashUser.discordBannerUrl,
    decorationUrl: dashUser.discordDecorationUrl,
    accent: dashUser.discordAccent,
  });
  display.manualBadges = getProfile(account.userId)?.manualBadges ?? [];

  return (
    <StaffPageShell
      showBack={false}
      className="max-w-6xl"
      title="Accueil"
      description="Ton espace GameMaster : missions, gives et atelier."
      ready={ready}
      actions={
        <Link href="/dashboard?view=create" className="rg-btn rg-btn-primary">
          <Plus className="h-4 w-4" /> Nouvelle mission
        </Link>
      }
    >
      <ProfileCard
        variant="banner"
        profile={display}
        roleLabel={gradeLabel}
        roleColor={gradeDef.color}
        gradeId={grade}
        href="/dashboard/profil"
        welcome="Retrouve tes missions, demandes et prochaines scènes."
        actions={
          <HomeMissionLog label="Noter une mission" />
        }
      />

      {cards.length > 0 ? (
        <div className="rg-metric-bar">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="px-4 py-4 transition-colors hover:bg-white/[0.03]"
            >
              <p className="text-[11px] text-white/40">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {ready ? card.value : "·"}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        {canSeeMissions ? (
          <section className="rg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold text-white">
                Mes dernières missions
              </h2>
              <Link
                href="/dashboard/missions"
                className="text-xs text-violet-300 hover:text-violet-100"
              >
                Tout voir
              </Link>
            </div>
            {!ready ? (
              <p className="p-6 text-sm text-white/50">Chargement…</p>
            ) : missions.length === 0 ? (
              <div className="rg-empty">
                <FilePenLine className="mb-2 h-6 w-6 text-white/30" />
                <p className="text-sm text-white/50">Pas encore de mission.</p>
                <Link
                  href="/dashboard?view=create"
                  className="rg-btn mt-3"
                >
                  Créer une proposition
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {missions.slice(0, 6).map((mission) => (
                  <li key={mission.id}>
                    <Link
                      href={
                        mission.status === "draft"
                          ? "/dashboard/brouillons"
                          : "/dashboard/missions"
                      }
                      className="rg-row"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {mission.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {mission.duration} ·{" "}
                          {new Date(mission.updatedAt).toLocaleDateString(
                            "fr-FR"
                          )}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${statuses[mission.status].color}`}
                      >
                        {statuses[mission.status].label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="rg-card space-y-2 p-3">
          <p className="px-1 text-[11px] tracking-wide text-white/35 uppercase">
            Création RP
          </p>
          {[
            {
              href: "/dashboard/atelier-scenes",
              title: "Atelier de scène",
              hint: "Préparer ta prochaine scène",
              icon: PencilRuler,
              visible: canAccessMissions(grade),
            },
            {
              href: "/dashboard/demandes-give",
              title: "Demandes de give",
              hint: "Suivre ou envoyer une demande",
              icon: Gift,
              visible: canSeeGives,
            },
            {
              href: "/dashboard/trames",
              title: "Trames en cours",
              hint: "Retrouver les arcs RP",
              icon: FilePenLine,
              visible: canSeeMissions,
            },
          ]
            .filter((item) => item.visible)
            .map((item) => (
              <Link key={item.href} href={item.href} className="rg-row">
                <item.icon className="h-4 w-4 shrink-0 text-violet-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-[11px] text-white/40">{item.hint}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
              </Link>
            ))}
        </section>
      </div>
    </StaffPageShell>
  );
}
