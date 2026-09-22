"use client";

import { useDashboardUser } from "@/components/layout/dashboard-user";
import { ReferentProfileView } from "@/components/referent-profile-view";
import { use } from "react";

export default function ReferentDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const user = useDashboardUser();
  const { userId } = use(params);

  return (
    <ReferentProfileView
      userId={decodeURIComponent(userId)}
      currentUserId={user.id}
    />
  );
}
