"use client";

import { useAccount } from "@/components/account-context";
import {
  canAccessPath,
  getGradeLabel,
  type GradeId,
} from "@/lib/permissions";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type CapabilityGateProps = {
  allow: (grade: GradeId) => boolean;
  children: ReactNode;
  fallbackTitle?: string;
  fallbackHint?: string;
};

export function CapabilityGate({
  allow,
  children,
  fallbackTitle = "Accès restreint",
  fallbackHint = "Ton grade ne permet pas d’ouvrir cette section.",
}: CapabilityGateProps) {
  const { grade } = useAccount();

  if (allow(grade)) return <>{children}</>;

  return (
    <DeniedScreen
      fallbackTitle={fallbackTitle}
      fallbackHint={fallbackHint}
      grade={grade}
    />
  );
}

function DeniedScreen({
  fallbackTitle,
  fallbackHint,
  grade,
}: {
  fallbackTitle: string;
  fallbackHint: string;
  grade: GradeId;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0b] p-6 text-white">
      <div className="rg-card w-full max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold">{fallbackTitle}</h1>
        <p className="text-sm text-white/45">{fallbackHint}</p>
        <p className="text-xs text-white/35">Grade : {getGradeLabel(grade)}</p>
        <Link href="/dashboard" className="rg-btn rg-btn-primary">
          Accueil
        </Link>
      </div>
    </div>
  );
}

export function RouteCapabilityGuard({ children }: { children: ReactNode }) {
  const { grade } = useAccount();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(pathname, grade);

  useEffect(() => {
    if (!allowed) router.replace("/dashboard");
  }, [allowed, router]);

  if (!allowed) {
    const homeAllowed = canAccessPath("/dashboard", grade);
    if (!homeAllowed) {
      return (
        <DeniedScreen
          fallbackTitle="Accès restreint"
          fallbackHint="Ton grade ne permet pas d’ouvrir le QG."
          grade={grade}
        />
      );
    }
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-white/40">
        Redirection…
      </div>
    );
  }

  return <>{children}</>;
}
