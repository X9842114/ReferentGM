"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { ReferentsPanel } from "@/components/referents-panel";
import { canViewProfiles } from "@/lib/permissions";

export default function ReferentsPage() {
  const user = useDashboardUser();
  return (
    <CapabilityGate
      allow={canViewProfiles}
      fallbackTitle="Profils réservés"
      fallbackHint="Ton grade n’a pas accès à l’annuaire."
    >
      <ReferentsPanel currentUserId={user.id} />
    </CapabilityGate>
  );
}
