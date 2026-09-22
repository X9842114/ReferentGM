"use client";

import { RevendicationsPanel } from "@/components/staff/revendications-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessRevendications } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessRevendications}
      fallbackTitle="Revendications réservées"
      fallbackHint="Les revendications sont réservées aux référents."
    >
      <RevendicationsPanel />
    </CapabilityGate>
  );
}
