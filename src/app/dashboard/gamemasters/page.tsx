"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { GamemastersPanel } from "@/components/staff/gamemasters-panel";
import { canManageGameMasters } from "@/lib/permissions";

export default function Page() {
  return (
    <CapabilityGate
      allow={canManageGameMasters}
      fallbackTitle="Intégration GM réservée"
      fallbackHint="Les référents voient les groupes GM, leurs profils et leurs missions."
    >
      <GamemastersPanel />
    </CapabilityGate>
  );
}
