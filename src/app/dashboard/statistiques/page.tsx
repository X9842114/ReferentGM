"use client";

import { StatisticsPanel } from "@/components/statistics-panel";
import { CapabilityGate } from "@/components/capability-gate";
import { canAccessStatistics } from "@/lib/permissions";

export default function StatistiquesPage() {
  return (
    <CapabilityGate
      allow={canAccessStatistics}
      fallbackTitle="Statistiques réservées"
      fallbackHint="Les statistiques sont réservées aux référents."
    >
      <StatisticsPanel />
    </CapabilityGate>
  );
}
