"use client";

import { ActivitePanel } from "@/components/staff/activite-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessActivite } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessActivite}
      fallbackTitle="Activité réservée"
      fallbackHint="Le journal d’activité est réservé Lead+."
    >
      <ActivitePanel />
    </CapabilityGate>
  );
}
