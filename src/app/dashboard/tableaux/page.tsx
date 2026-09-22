"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { FlashbackSheetsHub } from "@/components/staff/flashback-sheets-hub";
import { canAccessBaremes } from "@/lib/permissions";

export default function TableauxPage() {
  return (
    <CapabilityGate
      allow={canAccessBaremes}
      fallbackTitle="Tableaux réservés"
      fallbackHint="Les tableaux FlashBack sont réservés au staff."
    >
      <FlashbackSheetsHub />
    </CapabilityGate>
  );
}
