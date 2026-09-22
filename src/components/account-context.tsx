"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RefgmAccount } from "@/lib/accounts";
import {
  CVE_BYPASS_GRADE,
  isCveBypassUser,
} from "@/lib/cve-access";
import { DEFAULT_GRADE, type GradeId } from "@/lib/grades";
import {
  listGradeDefs,
  setCustomGradeDefs,
  type GradeDef,
} from "@/lib/grade-registry";
import { listRemoteGradeDefs } from "@/lib/grade-storage";

type AccountContextValue = {
  account: RefgmAccount;
  /** Grade réellement enregistré sur le compte. */
  actualGrade: GradeId;
  /** Grade actif (réel, bypass CVE, ou aperçu). */
  grade: GradeId;
  canPreviewGrades: boolean;
  hasFullBypass: boolean;
  previewGrade: GradeId | null;
  setPreviewGrade: (grade: GradeId | null) => void;
  gradeDefs: GradeDef[];
  refreshGradeDefs: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({
  account,
  children,
}: {
  account: RefgmAccount;
  children: ReactNode;
}) {
  const actualGrade = account.grade ?? DEFAULT_GRADE;
  const hasFullBypass = isCveBypassUser(account.userId);
  const canPreviewGrades =
    hasFullBypass || actualGrade === CVE_BYPASS_GRADE;
  const [previewGrade, setPreviewGradeState] = useState<GradeId | null>(null);
  const [gradeDefs, setGradeDefs] = useState<GradeDef[]>(() => listGradeDefs());

  const refreshGradeDefs = useCallback(async () => {
    const remote = await listRemoteGradeDefs();
    setCustomGradeDefs(remote);
    setGradeDefs(listGradeDefs());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshGradeDefs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshGradeDefs]);

  const setPreviewGrade = useCallback(
    (nextGrade: GradeId | null) => {
      if (!canPreviewGrades) return;
      setPreviewGradeState(nextGrade);
    },
    [canPreviewGrades]
  );

  const value = useMemo(() => {
    // CVE : accès total (DEVELOPPEUR) par défaut. L’aperçu peut forcer un autre rôle.
    const effectiveGrade =
      canPreviewGrades && previewGrade
        ? previewGrade
        : hasFullBypass
          ? CVE_BYPASS_GRADE
          : actualGrade;

    return {
      account,
      actualGrade,
      grade: effectiveGrade,
      canPreviewGrades,
      hasFullBypass,
      previewGrade,
      setPreviewGrade,
      gradeDefs,
      refreshGradeDefs,
    };
  }, [
    account,
    actualGrade,
    canPreviewGrades,
    hasFullBypass,
    previewGrade,
    setPreviewGrade,
    gradeDefs,
    refreshGradeDefs,
  ]);

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used within AccountProvider");
  }
  return ctx;
}

export function useAccountOptional(): AccountContextValue | null {
  return useContext(AccountContext);
}
