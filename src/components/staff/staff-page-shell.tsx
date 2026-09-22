"use client";

import { useRevealPage } from "@/components/layout/dashboard-page-gate";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function StaffPageShell({
  title,
  description,
  actions,
  children,
  className,
  backHref = "/dashboard",
  backLabel = "Accueil",
  showBack = true,
  ready = true,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
  ready?: boolean;
}) {
  useRevealPage(ready);

  return (
    <div className="min-h-dvh bg-transparent px-3 py-8 text-foreground sm:px-6 lg:px-8">
      <div className={cn("mx-auto w-full max-w-5xl space-y-8", className)}>
        <motion.header
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="min-w-0 space-y-3">
            {showBack ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            ) : (
              <p className="text-xs text-white/45">QG référents</p>
            )}
            <h1 className="bg-gradient-to-r from-white/90 to-white/40 bg-clip-text text-3xl font-medium tracking-tight text-transparent">
              {title}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/45">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </motion.header>
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
