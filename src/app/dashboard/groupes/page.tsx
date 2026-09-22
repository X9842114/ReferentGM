"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { GroupsAtlasPanel } from "@/components/groups-atlas-panel";
import { canBrowseGroups } from "@/lib/permissions";

export default function GroupesPage() {
  return (
    <CapabilityGate
      allow={canBrowseGroups}
      fallbackTitle="Groupes réservés"
      fallbackHint="Les référents voient ici tous les groupes et leur or."
    >
      <GroupsAtlasPanel />
    </CapabilityGate>
  );
}
