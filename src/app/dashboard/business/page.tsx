"use client";

import { BusinessPanel } from "@/components/staff/business-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessBusiness } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessBusiness}
      fallbackTitle="Business réservé"
      fallbackHint="L’assignation business est réservée aux référents."
    >
      <BusinessPanel />
    </CapabilityGate>
  );
}
