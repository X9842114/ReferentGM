"use client";

import { useAccount } from "@/components/account-context";
import { AccountSettingsPanel } from "@/components/account-settings-panel";
import { useDashboardUser, useSignOutAction } from "@/components/layout/dashboard-user";
import { GmDossierCard } from "@/components/gm-dossier-card";
import { ManualBadgeEditor } from "@/components/profile-badges";
import { ProfileCard } from "@/components/profile-card";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { displayDiscordId } from "@/lib/cve-access";
import { getGradeDef } from "@/lib/grade-registry";
import { canManageGrades, getGradeLabel } from "@/lib/permissions";
import {
  defaultProfile,
  getProfile,
  getProfileAsync,
  saveOwnProfile,
  setProfileManualBadges,
  type ManualProfileBadge,
  type ProfileVisual,
} from "@/lib/profile-storage";
import { useEffect, useState } from "react";

export function ProfilePanel() {
  const { grade } = useAccount();
  const user = useDashboardUser();
  const signOutAction = useSignOutAction();
  const canEditBadges = canManageGrades(grade);
  const [stored, setStored] = useState<ProfileVisual | null>(null);

  const profile = defaultProfile({
    userId: user.id,
    name: user.name,
    image: user.image,
    discordLinked: user.discordLinked,
    discordId:
      user.discordId ||
      (displayDiscordId(user.id) || user.id),
    bannerUrl: user.discordBannerUrl,
    decorationUrl: user.discordDecorationUrl,
    accent: user.discordAccent,
  });
  if (stored) {
    profile.manualBadges = stored.manualBadges;
    profile.bio = stored.bio;
    profile.hasIgPerms = stored.hasIgPerms;
    if (stored.bannerDataUrl) profile.bannerDataUrl = stored.bannerDataUrl;
  }

  useEffect(() => {
    const refresh = () => {
      setStored(getProfile(user.id));
      void getProfileAsync(user.id).then(setStored);
    };
    refresh();
    window.addEventListener("refgm:profile-updated", refresh);
    return () => window.removeEventListener("refgm:profile-updated", refresh);
  }, [user.id]);

  return (
    <StaffPageShell
      title="Profil"
      description="Profil Discord et réglages."
      className="max-w-3xl"
    >
      <ProfileCard
        featured
        editable
        profile={profile}
        roleLabel={getGradeLabel(grade)}
        roleColor={getGradeDef(grade).color}
        gradeId={grade}
        onBannerChange={(bannerDataUrl) => {
          saveOwnProfile({ ...profile, bannerDataUrl });
          setStored(getProfile(user.id));
        }}
      />
      <AccountSettingsPanel profile={profile} signOutAction={signOutAction} />
      {canEditBadges ? (
        <ManualBadgeEditor
          badges={profile.manualBadges}
          onChange={(next: ManualProfileBadge[]) => {
            setProfileManualBadges(user.id, next, profile);
            setStored(getProfile(user.id));
          }}
        />
      ) : null}
      <GmDossierCard userId={user.id} />
    </StaffPageShell>
  );
}
