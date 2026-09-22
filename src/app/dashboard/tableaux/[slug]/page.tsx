"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { FlashbackSheetView } from "@/components/staff/flashback-sheet-view";
import { canAccessBaremes } from "@/lib/permissions";
import { use } from "react";

export default function TableauDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <CapabilityGate
      allow={canAccessBaremes}
      fallbackTitle="Tableaux réservés"
      fallbackHint="Les tableaux FlashBack sont réservés au staff."
    >
      <FlashbackSheetView slug={slug} />
    </CapabilityGate>
  );
}
