"use client";

import { MarcheOrPanel } from "@/components/staff/marche-or-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessMarcheOr } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canAccessMarcheOr}
      fallbackTitle="Marché Or réservé"
      fallbackHint="Le marché Or est réservé aux référents."
    >
      <MarcheOrPanel />
    </CapabilityGate>
  );
}
