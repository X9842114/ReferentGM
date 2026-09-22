"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redirige hors bande si déjà connecté — ne bloque pas le premier rendu. */
export function LoginSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        if (!cancelled && session?.user) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
