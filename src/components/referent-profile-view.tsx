"use client";

import { useAccount } from "@/components/account-context";
import { ManualBadgeEditor } from "@/components/profile-badges";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { ProfileCard } from "@/components/profile-card";
import { GmDossierCard } from "@/components/gm-dossier-card";
import { getAccount, type RefgmAccount } from "@/lib/accounts";
import { getGradeDef } from "@/lib/grade-registry";
import { canManageGrades, getGradeLabel } from "@/lib/permissions";
import {
  defaultProfile,
  getProfile,
  setProfileManualBadges,
  type ManualProfileBadge,
  type ProfileVisual,
} from "@/lib/profile-storage";
import Link from "next/link";
import { useEffect, useState } from "react";

type ReferentProfileViewProps = {
  userId: string;
  currentUserId: string;
};

function mergeProfile(
  account: RefgmAccount,
  stored: ProfileVisual | null
): ProfileVisual {
  const base = defaultProfile({
    userId: account.userId,
    name: account.displayName,
    image: stored?.discordAvatarUrl || account.discordAvatarUrl,
    discordLinked: account.discordLinked,
    discordId: account.userId,
  });
  if (!stored) return base;
  return {
    ...base,
    bio: stored.bio || base.bio,
    bannerDataUrl: stored.bannerDataUrl || base.bannerDataUrl,
    hasIgPerms: stored.hasIgPerms || base.hasIgPerms,
    accent: stored.accent || base.accent,
    decorationUrl: stored.decorationUrl ?? base.decorationUrl,
    manualBadges: stored.manualBadges ?? [],
  };
}

export function ReferentProfileView({ userId }: ReferentProfileViewProps) {
  const { grade } = useAccount();
  const canEditBadges = canManageGrades(grade);
  const [account, setAccount] = useState<RefgmAccount | null>(null);
  const [stored, setStored] = useState<ProfileVisual | null>(null);

  useEffect(() => {
    const refresh = () => {
      void getAccount(userId).then(setAccount);
      setStored(getProfile(userId));
    };
    refresh();
    window.addEventListener("refgm:accounts-updated", refresh);
    window.addEventListener("refgm:profile-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("refgm:accounts-updated", refresh);
      window.removeEventListener("refgm:profile-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  const gradeId = account?.status === "APPROVED" ? account.grade : null;
  const roleLabel = gradeId ? getGradeLabel(gradeId) : null;
  const roleColor = gradeId ? getGradeDef(gradeId).color : null;
  const display = account ? mergeProfile(account, stored) : null;

  function saveBadges(next: ManualProfileBadge[]) {
    const saved = setProfileManualBadges(userId, next, display ?? undefined);
    setStored(saved);
  }

  return (
    <StaffPageShell
      title={display?.displayName || "Profil"}
      description={roleLabel || "Profil Discord"}
      className="max-w-3xl"
      backHref="/dashboard/referents"
      backLabel="Annuaire"
    >
      {display ? (
        <div className="space-y-4">
          <ProfileCard
            profile={display}
            roleLabel={roleLabel}
            roleColor={roleColor}
            gradeId={gradeId}
          />
          {canEditBadges ? (
            <ManualBadgeEditor
              badges={display.manualBadges}
              onChange={saveBadges}
            />
          ) : null}
          <GmDossierCard userId={userId} />
          {account ? (
            <div className="rg-card px-4 py-3">
              <p className="text-[11px] text-white/35">Compte créé</p>
              <p className="mt-1 text-sm text-white/80">
                {new Date(account.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rg-empty">
          <p className="text-sm text-white/55">Profil introuvable</p>
          <Link href="/dashboard/referents" className="rg-btn mt-4">
            Retour à l’annuaire
          </Link>
        </div>
      )}
    </StaffPageShell>
  );
}
