"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { ReferentPlanningPanel } from "@/components/referent-planning-panel";
import { canAccessPlanning } from "@/lib/permissions";

export default function PlanningPage() {
  return (
    <CapabilityGate
      allow={canAccessPlanning}
      fallbackTitle="Planning réservé"
      fallbackHint="Le planning des permanences est pour les référents."
    >
      <ReferentPlanningPanel />
    </CapabilityGate>
  );
}
