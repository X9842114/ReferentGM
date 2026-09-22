"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { RoadmapPanel } from "@/components/roadmap-panel";
import { canAccessAvancement } from "@/lib/permissions";

export default function AvancementPage() {
  return (
    <CapabilityGate
      allow={canAccessAvancement}
      fallbackTitle="Avancement"
      fallbackHint="Les propositions et le vote sont réservés aux référents."
    >
      <RoadmapPanel />
    </CapabilityGate>
  );
}
