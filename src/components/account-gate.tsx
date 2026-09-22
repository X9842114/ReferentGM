"use client";

import { AccountProvider } from "@/components/account-context";
import { AuthSplash } from "@/components/auth/auth-splash";
import {
  AccountApprovedCelebration,
  PendingAccountScreen,
  RejectedAccountScreen,
} from "@/components/account-status-screens";
import { RouteCapabilityGuard } from "@/components/capability-gate";
import {
  ensureAccount,
  getAccount,
  getAccountSync,
  type RefgmAccount,
} from "@/lib/accounts";
import {
  CVE_BYPASS_GRADE,
  isCveBypassUser,
} from "@/lib/cve-access";
import { DEFAULT_GRADE } from "@/lib/grades";
import { getGradeLabel } from "@/lib/permissions";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type AccountGateProps = {
  userId: string;
  userName?: string | null;
  userImage?: string | null;
  discordId?: string | null;
  discordLinked?: boolean;
  suggestedGrade?: string | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
};

function stubAccount(
  userId: string,
  userName?: string | null,
  userImage?: string | null,
  discordLinked = false,
  cve = false
): RefgmAccount {
  const now = new Date().toISOString();
  return {
    userId,
    displayName: userName?.trim() || "Référent",
    discordAvatarUrl: userImage?.trim() || "",
    discordLinked,
    status: cve ? "APPROVED" : "PENDING",
    grade: cve ? CVE_BYPASS_GRADE : DEFAULT_GRADE,
    createdAt: now,
    updatedAt: now,
    reviewedBy: cve ? "cve-bypass" : null,
    reviewedAt: cve ? now : null,
  };
}

export function AccountGate({
  userId,
  userName,
  userImage,
  discordId = null,
  discordLinked = false,
  suggestedGrade = null,
  signOutAction,
  children,
}: AccountGateProps) {
  const cve =
    isCveBypassUser(userId) ||
    isCveBypassUser(discordId) ||
    isCveBypassUser(discordId);
  const [account, setAccount] = useState<RefgmAccount | null>(() =>
    cve ? stubAccount(userId, userName, userImage, discordLinked, true) : null
  );
  const [ready, setReady] = useState(cve);
  const [checking, setChecking] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const sawPendingRef = useRef(false);
  const celebrateStartedRef = useRef(false);

  const applyAccount = useCallback(
    (next: RefgmAccount) => {
      if (next.status === "PENDING") {
        sawPendingRef.current = true;
      }

      if (
        next.status === "APPROVED" &&
        sawPendingRef.current &&
        !celebrateStartedRef.current &&
        !cve
      ) {
        celebrateStartedRef.current = true;
        setCelebrating(true);
      }

      setAccount(next);
      setReady(true);
    },
    [userId, cve]
  );

  useLayoutEffect(() => {
    const local = getAccountSync(userId);
    if (local) applyAccount(local);
  }, [userId, applyAccount]);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const next = await ensureAccount({
          userId,
          displayName: userName,
          image: userImage,
          discordLinked,
          suggestedGrade,
        });
        if (cancelled) return;
        // Si le cache local est encore PENDING, forcer un refresh distant.
        if (next.status === "PENDING") {
          const remote = await getAccount(userId);
          if (!cancelled) applyAccount(remote ?? next);
          return;
        }
        applyAccount(next);
      } catch {
        if (!cancelled && !getAccountSync(userId)) {
          setReady(true);
        }
      }
    }

    const onUpdate = () => {
      const latest = getAccountSync(userId);
      if (latest) applyAccount(latest);
    };

    const timer = window.setTimeout(() => void sync(), 0);
    const failsafe = window.setTimeout(() => {
      if (cancelled) return;
      const local = getAccountSync(userId);
      if (local) {
        applyAccount(local);
        return;
      }
      applyAccount(stubAccount(userId, userName, userImage, discordLinked, cve));
    }, 1200);
    window.addEventListener("refgm:accounts-updated", onUpdate);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(failsafe);
      window.removeEventListener("refgm:accounts-updated", onUpdate);
    };
  }, [userId, userName, userImage, discordLinked, applyAccount, cve]);

  // Pendant l’attente, poller le distant pour détecter la validation.
  useEffect(() => {
    if (account?.status !== "PENDING" || celebrating) return;

    let cancelled = false;

    async function poll() {
      setChecking(true);
      try {
        const next = await getAccount(userId);
        if (!cancelled && next) applyAccount(next);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    const first = window.setTimeout(() => void poll(), 1500);
    const interval = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [account?.status, celebrating, userId, applyAccount]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
  }, []);

  if (!ready || !account) {
    return (
      <AuthSplash
        fullscreen={false}
        title="RefGM"
        subtitle="Vérification du compte…"
        userImage={userImage}
      />
    );
  }

  if (celebrating) {
    return (
      <AccountApprovedCelebration
        userName={userName ?? account.displayName}
        userImage={userImage ?? account.discordAvatarUrl}
        gradeLabel={getGradeLabel(account.grade)}
        onDone={finishCelebration}
      />
    );
  }

  // CVE : entrée dashboard même si le statut DB n’est pas encore à jour.
  if (account.status === "APPROVED" || cve) {
    return (
      <AccountProvider account={account}>
        <RouteCapabilityGuard>{children}</RouteCapabilityGuard>
      </AccountProvider>
    );
  }

  if (account.status === "PENDING") {
    return (
      <PendingAccountScreen
        userName={userName ?? account.displayName}
        userImage={userImage ?? account.discordAvatarUrl}
        signOutAction={signOutAction}
        checking={checking}
      />
    );
  }

  return <RejectedAccountScreen signOutAction={signOutAction} />;
}
