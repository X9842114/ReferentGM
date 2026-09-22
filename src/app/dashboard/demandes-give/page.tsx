"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { DemandesGivePanel } from "@/components/staff/demandes-give-panel";
import { canReviewGiveRequests } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canReviewGiveRequests}
      fallbackTitle="Demandes de Give"
      fallbackHint="Le traitement des demandes est réservé aux Référents GM."
    >
      <DemandesGivePanel />
    </CapabilityGate>
  );
}
