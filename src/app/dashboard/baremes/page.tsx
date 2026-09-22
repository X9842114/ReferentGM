"use client";

import { BaremesPanel } from "@/components/staff/baremes-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessBaremes } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessBaremes}
      fallbackTitle="Barèmes réservés"
      fallbackHint="Les barèmes Or sont réservés au staff et aux GM."
    >
      <BaremesPanel />
    </CapabilityGate>
  );
}
