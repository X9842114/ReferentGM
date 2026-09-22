"use client";

import { ReglementsPanel } from "@/components/staff/reglements-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessReglementsPage } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessReglementsPage}
      fallbackTitle="Règlements réservés"
      fallbackHint="Les règlements sont réservés au staff RefGM."
    >
      <ReglementsPanel />
    </CapabilityGate>
  );
}
