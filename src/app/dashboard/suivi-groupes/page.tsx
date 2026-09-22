"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { GroupRewardSuiviPanel } from "@/components/group-reward-suivi-panel";
import { canAccessSuiviGroupes } from "@/lib/permissions";

export default function SuiviGroupesPage() {
  return (
    <CapabilityGate
      allow={canAccessSuiviGroupes}
      fallbackTitle="Suivi réservé"
      fallbackHint="Les référents notent ici ce que les GM donnent aux groupes."
    >
      <GroupRewardSuiviPanel />
    </CapabilityGate>
  );
}
