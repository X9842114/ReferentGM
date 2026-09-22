"use client";

import { RapportsPanel } from "@/components/staff/rapports-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessMeetingReports } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessMeetingReports}
      fallbackTitle="Rapports réservés"
      fallbackHint="Les rapports d’équipe sont réservés Lead+."
    >
      <RapportsPanel />
    </CapabilityGate>
  );
}
