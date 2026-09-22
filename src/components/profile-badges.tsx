"use client";

import {
  MANUAL_PROFILE_BADGES,
  type ManualProfileBadge,
} from "@/lib/profile-storage";
import { cn } from "@/lib/utils";
import { Crown, Fingerprint, Link2, Link2Off, Shield, ShieldCheck, UserCog } from "lucide-react";

const MANUAL_STYLE: Record<
  ManualProfileBadge,
  { icon: typeof Shield; className: string }
> = {
  moderateur: {
    icon: ShieldCheck,
    className:
      "border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.16)]",
  },
  staff: {
    icon: Shield,
    className:
      "border-amber-400/40 bg-amber-400/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.16)]",
  },
  gestionnaire: {
    icon: UserCog,
    className:
      "border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-[0_0_12px_rgba(56,189,248,0.16)]",
  },
  responsable: {
    icon: Crown,
    className:
      "border-rose-400/40 bg-rose-500/15 text-rose-100 shadow-[0_0_12px_rgba(251,113,133,0.18)]",
  },
};

export function ProfileBadgeChip({
  icon: Icon,
  label,
  title,
  className,
  mono,
}: {
  icon: typeof Shield;
  label: string;
  title?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      title={title || label}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        mono && "font-mono font-medium tracking-normal",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ManualBadgeChip({ id }: { id: ManualProfileBadge }) {
  const meta = MANUAL_PROFILE_BADGES.find((b) => b.id === id);
  const style = MANUAL_STYLE[id];
  const Icon = style.icon;
  return (
    <ProfileBadgeChip
      icon={Icon}
      label={meta?.label ?? id}
      className={style.className}
    />
  );
}

export function DiscordLinkBadge({ linked }: { linked: boolean }) {
  return (
    <ProfileBadgeChip
      icon={linked ? Link2 : Link2Off}
      label={linked ? "Discord lié" : "Discord non lié"}
      className={
        linked
          ? "border-violet-400/35 bg-violet-400/12 text-violet-100"
          : "border-white/10 bg-white/[0.03] text-white/40"
      }
    />
  );
}

export function UniqueIdBadge({ id }: { id: string }) {
  return (
    <ProfileBadgeChip
      icon={Fingerprint}
      label={id}
      title="ID Discord"
      mono
      className="border-white/10 bg-white/[0.04] text-white/70"
    />
  );
}

export function ProfileManualBadges({
  badges,
}: {
  badges: ManualProfileBadge[];
}) {
  if (!badges.length) return null;
  return (
    <>
      {badges.map((id) => (
        <ManualBadgeChip key={id} id={id} />
      ))}
    </>
  );
}

export function ManualBadgeEditor({
  badges,
  onChange,
}: {
  badges: ManualProfileBadge[];
  onChange: (next: ManualProfileBadge[]) => void;
}) {
  return (
    <div className="rg-card space-y-3 p-4">
      <p className="text-sm font-semibold text-white">Badges</p>
      <p className="text-xs text-white/40">
        Ajoute Modérateur, Staff, Gestionnaire ou Responsable. Ça s’affiche
        sur la carte profil, en plus du grade.
      </p>
      <div className="flex flex-wrap gap-2">
        {MANUAL_PROFILE_BADGES.map((badge) => {
          const active = badges.includes(badge.id);
          return (
            <button
              key={badge.id}
              type="button"
              onClick={() =>
                onChange(
                  active
                    ? badges.filter((id) => id !== badge.id)
                    : [...badges, badge.id]
                )
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                active
                  ? MANUAL_STYLE[badge.id].className
                  : "border-white/10 text-white/45 hover:border-white/20 hover:text-white"
              )}
            >
              {badge.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
