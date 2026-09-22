"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { TramesPanel } from "@/components/trames-panel";
import { canAccessTrames } from "@/lib/permissions";

export default function TramesPage() {
  return (
    <CapabilityGate
      allow={canAccessTrames}
      fallbackTitle="Trames réservées"
      fallbackHint="Les trames GM sont visibles des référents."
    >
      <TramesPanel />
    </CapabilityGate>
  );
}
