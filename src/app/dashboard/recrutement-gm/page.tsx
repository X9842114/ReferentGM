"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { StaffRecruitmentPanel } from "@/components/recruitment/staff-recruitment-panel";
import { canAccessStaffTools } from "@/lib/permissions";

export default function Page() {
  return <CapabilityGate allow={canAccessStaffTools} fallbackTitle="Recrutement réservé aux référents"><StaffRecruitmentPanel /></CapabilityGate>;
}
