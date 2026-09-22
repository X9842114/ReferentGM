"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { DevFeedbackPanel } from "@/components/dev-feedback-panel";
import { canSubmitDevFeedback } from "@/lib/permissions";

export default function SignalerPage() {
  return (
    <CapabilityGate
      allow={canSubmitDevFeedback}
      fallbackTitle="Signalements réservés"
      fallbackHint="Seuls les référents peuvent écrire au développeur."
    >
      <DevFeedbackPanel />
    </CapabilityGate>
  );
}
