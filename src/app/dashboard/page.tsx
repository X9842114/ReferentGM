"use client";

import { useAccount } from "@/components/account-context";
import { LoginTransition } from "@/components/auth/login-transition";
import { GameMasterHome } from "@/components/gamemaster-home";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { ReferentHome } from "@/components/referent-home";
import { canAccessReferentHq } from "@/lib/permissions";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const user = useDashboardUser();
  const { grade } = useAccount();
  const [playWelcome, setPlayWelcome] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPlayWelcome(params.get("welcome") === "1");
  }, []);

  return (
    <LoginTransition
      play={playWelcome}
      userName={user.name}
      userImage={user.image}
    >
      {canAccessReferentHq(grade) ? (
        <ReferentHome userName={user.name} />
      ) : (
        <GameMasterHome userName={user.name} />
      )}
    </LoginTransition>
  );
}
