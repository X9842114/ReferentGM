"use client";

import {
  PageSkeleton,
  skeletonVariantForPath,
} from "@/components/page-skeleton";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const MIN_MS = 40;
const FAILSAFE_MS = 280;

const PageReadyContext = createContext<{ reveal: () => void } | null>(null);

export function DashboardPageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const first = useRef(true);
  const shownAt = useRef(0);
  const revealTimer = useRef<number>(0);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    shownAt.current = performance.now();
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) return;
    const failsafe = window.setTimeout(() => setOpen(true), FAILSAFE_MS);
    return () => window.clearTimeout(failsafe);
  }, [open, pathname]);

  const reveal = useCallback(() => {
    window.clearTimeout(revealTimer.current);
    const wait = Math.max(0, MIN_MS - (performance.now() - shownAt.current));
    revealTimer.current = window.setTimeout(() => setOpen(true), wait);
  }, []);

  return (
    <PageReadyContext.Provider value={{ reveal }}>
      <div className="relative min-h-dvh">
        {open ? null : (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-transparent">
            <PageSkeleton variant={skeletonVariantForPath(pathname)} />
          </div>
        )}
        <div
          className={open ? undefined : "invisible h-0 overflow-hidden"}
          aria-hidden={!open}
        >
          {children}
        </div>
      </div>
    </PageReadyContext.Provider>
  );
}

export function useRevealPage(ready: boolean) {
  const ctx = useContext(PageReadyContext);
  useEffect(() => {
    if (ready) ctx?.reveal();
  }, [ready, ctx]);
}
