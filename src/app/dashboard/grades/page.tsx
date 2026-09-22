"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { GradesPanel } from "@/components/grades-panel";
import { canManageGrades } from "@/lib/permissions";

export default function GradesPage() {
  return (
    <CapabilityGate
      allow={canManageGrades}
      fallbackTitle="Gestion des grades"
      fallbackHint="Seuls Lead, Co-Lead, Superviseur et Développeur peuvent gérer les grades."
    >
      <GradesPanel />
    </CapabilityGate>
  );
}
