"use client";

import { BlacklistPanel } from "@/components/staff/blacklist-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessBlacklist } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessBlacklist}
      fallbackTitle="Blacklist réservée"
      fallbackHint="La blacklist est réservée aux référents."
    >
      <BlacklistPanel />
    </CapabilityGate>
  );
}
