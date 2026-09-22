"use client";

import { CapabilityGate } from "@/components/capability-gate";
import { DashboardPanelSkeleton } from "@/components/dashboard-panel-skeleton";
import { canReadMissions } from "@/lib/permissions";
import dynamic from "next/dynamic";

const MissionsPanel = dynamic(
  () => import("@/components/drafts-panel").then((module) => module.DraftsPanel),
  { ssr: false, loading: DashboardPanelSkeleton }
);

export default function MissionsPage() {
  return <CapabilityGate allow={canReadMissions} fallbackTitle="Missions réservées" fallbackHint="La validation des missions est réservée aux Référents GM."><MissionsPanel /></CapabilityGate>;
}
