"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { SupervisionPanel } from "@/components/staff/supervision-panel";
import { canAccessLeadTools } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessLeadTools}
      fallbackTitle="Supervision réservée"
      fallbackHint="Accessible au Développeur, Superviseur, Lead et Co-Lead."
    >
      <SupervisionPanel />
    </CapabilityGate>
  );
}
