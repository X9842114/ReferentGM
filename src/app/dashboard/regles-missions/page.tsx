"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { MissionReviewSettingsPanel } from "@/components/staff/mission-review-settings-panel";
import { canConfigureMissionReview } from "@/lib/mission-settings";

export default function ReglesMissionsPage() {
  return (
    <CapabilityGate
      allow={canConfigureMissionReview}
      fallbackTitle="Règles missions réservées"
      fallbackHint="Seul le Développeur, Superviseur, Lead ou Co-Lead peut configurer lecture / vote."
    >
      <MissionReviewSettingsPanel />
    </CapabilityGate>
  );
}
