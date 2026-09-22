"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { GmMissionActivity } from "@/components/gm-mission-activity";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { canAccessMissionsGm } from "@/lib/permissions";

export default function MissionsGmPage() {
  return (
    <CapabilityGate
      allow={canAccessMissionsGm}
      fallbackTitle="Missions GM"
      fallbackHint="Le suivi des missions GM est réservé aux référents."
    >
      <StaffPageShell
        title="Missions GM"
        description="Choisis un groupe GM et la période : courbe, or, et tous les groupes que l’équipe a missionnés."
        className="max-w-5xl"
      >
        <GmMissionActivity />
      </StaffPageShell>
    </CapabilityGate>
  );
}
