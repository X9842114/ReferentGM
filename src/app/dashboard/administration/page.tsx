"use client";

import { AdministrationHub } from "@/components/administration-hub";
import { CapabilityGate } from "@/components/capability-gate";
import { canOpenAdminHub } from "@/lib/permissions";

export default function AdministrationPage() {
  return (
    <CapabilityGate
      allow={canOpenAdminHub}
      fallbackTitle="Administration réservée"
      fallbackHint="Le hub Administration est réservé aux référents et au staff."
    >
      <AdministrationHub />
    </CapabilityGate>
  );
}
