"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { ValidationPanel } from "@/components/validation-panel";
import { canVerifyAccounts } from "@/lib/permissions";

export default function ValidationPage() {
  const user = useDashboardUser();
  return (
    <CapabilityGate
      allow={canVerifyAccounts}
      fallbackTitle="Validation réservée"
      fallbackHint="La validation des comptes commence au Manager Référent."
    >
      <ValidationPanel reviewerId={user.id} />
    </CapabilityGate>
  );
}
