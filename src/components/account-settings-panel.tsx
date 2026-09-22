"use client";

import { GradePreviewMenu } from "@/components/grade-preview-menu";
import {
  defaultAccountPrefs,
  getAccountPrefs,
  saveAccountPrefs,
  type AccountPrefs,
} from "@/lib/account-prefs";
import { saveOwnProfile, type ProfileVisual } from "@/lib/profile-storage";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
type AccountSettingsPanelProps = {
  profile: ProfileVisual;
  signOutAction: () => Promise<void>;
};

export function AccountSettingsPanel({
  profile,
  signOutAction,
}: AccountSettingsPanelProps) {
  const [bio, setBio] = useState(profile.bio);
  const [hasIgPerms, setHasIgPerms] = useState(profile.hasIgPerms);
  const [prefs, setPrefs] = useState<AccountPrefs>(defaultAccountPrefs);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBio(profile.bio);
    setHasIgPerms(profile.hasIgPerms);
    setPrefs(getAccountPrefs(profile.userId));
  }, [profile.userId, profile.bio, profile.hasIgPerms]);

  function persistProfile(next: Partial<ProfileVisual>) {
    saveOwnProfile({
      ...profile,
      ...next,
      userId: profile.userId,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  function persistPrefs(next: AccountPrefs) {
    setPrefs(saveAccountPrefs(profile.userId, next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <section className="rg-card space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Réglages du compte</h3>
          <p className="mt-1 text-xs text-white/40">
            Ces options restent sur cet appareil. L’avatar Discord ne se change pas ici.
          </p>
        </div>
        {saved ? (
          <span className="text-[11px] font-medium text-emerald-300">Enregistré</span>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium tracking-wide text-white/45 uppercase">
          Bio
        </span>
        <textarea
          value={bio}
          rows={3}
          maxLength={280}
          onChange={(e) => setBio(e.target.value)}
          onBlur={() => {
            if (bio.trim() !== profile.bio.trim()) persistProfile({ bio: bio.trim() });
          }}
          placeholder="Quelques mots sur toi…"
          className="rg-field min-h-[5rem] resize-y"
        />
      </label>

      <ToggleRow
        label="Permissions in-game"
        hint="Indique si tu as les perms IG sur le serveur."
        checked={hasIgPerms}
        onChange={(checked) => {
          setHasIgPerms(checked);
          persistProfile({ hasIgPerms: checked });
        }}
      />
      <ToggleRow
        label="Notifs planning"
        hint="Tâches et créneaux assignés."
        checked={prefs.notifyPlanning}
        onChange={(checked) =>
          persistPrefs({ ...prefs, notifyPlanning: checked })
        }
      />
      <ToggleRow
        label="Notifs comptes"
        hint="File Discord et validations."
        checked={prefs.notifyAccounts}
        onChange={(checked) =>
          persistPrefs({ ...prefs, notifyAccounts: checked })
        }
      />

      <GradePreviewMenu variant="field" />

      <form action={signOutAction} className="border-t border-white/[0.06] pt-4">
        <button type="submit" className="rg-btn w-full text-rose-200 hover:border-rose-400/30 hover:bg-rose-500/10">
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </form>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-left"
    >
      <span>
        <span className="block text-sm text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-white/40">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-violet-400" : "bg-white/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </button>
  );
}
