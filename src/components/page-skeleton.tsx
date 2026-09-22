import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PageSkeletonVariant =
  | "home"
  | "cards"
  | "list"
  | "suivi"
  | "kanban"
  | "calendar"
  | "default";

export function skeletonVariantForPath(pathname: string): PageSkeletonVariant {
  if (pathname === "/dashboard") return "home";
  if (pathname.startsWith("/dashboard/profil")) return "home";
  if (
    pathname.startsWith("/dashboard/avancement") ||
    pathname.startsWith("/dashboard/roadmap")
  ) {
    return "kanban";
  }
  if (pathname.startsWith("/dashboard/planning")) return "calendar";
  if (
    pathname.startsWith("/dashboard/suivi-groupes") ||
    pathname.startsWith("/dashboard/propositions")
  ) {
    return "suivi";
  }
  if (
    pathname.startsWith("/dashboard/groupes") ||
    pathname.startsWith("/dashboard/referents") ||
    pathname.startsWith("/dashboard/grades")
  ) {
    return "cards";
  }
  if (
    pathname.startsWith("/dashboard/gamemasters") ||
    pathname.startsWith("/dashboard/rapports") ||
    pathname.startsWith("/dashboard/activite") ||
    pathname.startsWith("/dashboard/supervision") ||
    pathname.startsWith("/dashboard/validation") ||
    pathname.startsWith("/dashboard/trames") ||
    pathname.startsWith("/dashboard/brouillons")
  ) {
    return "list";
  }
  return "default";
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("rg-skel", className)} />;
}

function Card({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rg-card overflow-hidden p-4", className)}>{children}</div>
  );
}

export function PageSkeleton({
  variant = "default",
}: {
  variant?: PageSkeletonVariant;
}) {
  return (
    <div
      className="min-h-dvh bg-transparent px-3 py-8 text-foreground sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Chargement de la page"
    >
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-3">
          <Bone className="h-3 w-16 !rounded-full !shadow-none" />
          <Bone className="h-8 w-52 max-w-full !rounded-lg !shadow-none" />
          <Bone className="h-4 w-80 max-w-full !rounded-lg !shadow-none" />
        </div>
        {variant === "home" ? <HomeBones /> : null}
        {variant === "cards" ? <CardsBones /> : null}
        {variant === "list" ? <ListBones /> : null}
        {variant === "suivi" ? <SuiviBones /> : null}
        {variant === "kanban" ? <KanbanBones /> : null}
        {variant === "calendar" ? <CalendarBones /> : null}
        {variant === "default" ? <DefaultBones /> : null}
      </div>
    </div>
  );
}

function HomeBones() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-8">
        <div className="rg-card overflow-hidden">
          <Bone className="h-36 w-full !rounded-none" />
          <div className="flex items-end gap-4 p-4">
            <Bone className="-mt-12 h-20 w-20 !rounded-full" />
            <div className="flex-1 space-y-2 pb-1">
              <Bone className="h-5 w-40 !rounded-lg !shadow-none" />
              <Bone className="h-3 w-24 !rounded-full !shadow-none" />
            </div>
            <Bone className="mb-1 h-11 w-40 !rounded-full" />
          </div>
        </div>
        <Card className="space-y-0 p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <Bone className="h-4 w-24 !rounded-lg !shadow-none" />
            <Bone className="h-3 w-16 !rounded-lg !shadow-none" />
          </div>
          <div className="space-y-0 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-48 !rounded-lg !shadow-none" />
                <Bone className="h-3 w-32 !rounded-full !shadow-none" />
              </div>
              <Bone className="h-8 w-14 !rounded-lg" />
            </div>
            <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3">
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-40 !rounded-lg !shadow-none" />
                <Bone className="h-3 w-28 !rounded-full !shadow-none" />
              </div>
              <Bone className="h-8 w-14 !rounded-lg" />
            </div>
          </div>
        </Card>
      </div>
      <div className="lg:col-span-4">
        <Card className="space-y-0 p-0">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <Bone className="h-4 w-24 !rounded-lg !shadow-none" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Bone className="h-10 w-10 !rounded-xl" />
              <div className="flex-1 space-y-2">
                <Bone className="h-3.5 w-28 !rounded-lg !shadow-none" />
                <Bone className="h-2.5 w-36 !rounded-lg !shadow-none" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function CardsBones() {
  return (
    <>
      <Card>
        <Bone className="mb-3 h-4 w-36 !rounded-lg !shadow-none" />
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_7rem_auto]">
          <Bone className="h-11 !rounded-xl" />
          <Bone className="h-11 !rounded-xl" />
          <Bone className="h-11 !rounded-xl" />
          <Bone className="h-11 w-28 !rounded-xl" />
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Bone className="h-9 w-20 !rounded-full" />
        <Bone className="h-9 w-16 !rounded-full" />
        <Bone className="h-9 w-20 !rounded-full" />
        <Bone className="h-9 w-16 !rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex items-start justify-between">
              <Bone className="h-5 w-16 !rounded-full" />
              <Bone className="h-8 w-8 !rounded-lg" />
            </div>
            <Bone className="h-5 w-40 !rounded-lg !shadow-none" />
            <Bone className="h-3 w-24 !rounded-lg !shadow-none" />
            <div className="flex gap-2 pt-2">
              <Bone className="h-8 w-8 !rounded-full" />
              <Bone className="h-8 w-8 !rounded-full" />
              <Bone className="h-8 w-8 !rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ListBones() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Bone className="h-11 min-w-[220px] flex-1 !rounded-xl" />
        <Bone className="h-4 w-28 !rounded-lg !shadow-none" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="space-y-0 p-0">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="space-y-2">
              <Bone className="h-5 w-44 !rounded-lg !shadow-none" />
              <Bone className="h-3 w-32 !rounded-lg !shadow-none" />
            </div>
            <Bone className="h-3 w-12 !rounded-lg !shadow-none" />
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex gap-3">
              <Bone className="h-16 w-16 !rounded-2xl" />
              <Bone className="h-16 w-16 !rounded-2xl" />
              <Bone className="h-16 w-16 !rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Bone className="h-3 w-24 !rounded-lg !shadow-none" />
              <Bone className="h-10 w-full !rounded-xl" />
              <Bone className="h-10 w-2/3 !rounded-xl" />
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function SuiviBones() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Bone className="h-8 w-20 !rounded-full" />
        <Bone className="h-8 w-24 !rounded-full" />
        <Bone className="h-8 w-16 !rounded-full" />
        <Bone className="h-8 w-14 !rounded-full" />
        <Bone className="h-8 w-12 !rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <div className="flex items-center justify-between">
              <Bone className="h-5 w-16 !rounded-full" />
              <Bone className="h-4 w-10 !rounded-lg !shadow-none" />
            </div>
            <Bone className="h-5 w-36 !rounded-lg !shadow-none" />
            <Bone className="h-2 w-full !rounded-full" />
            <div className="flex gap-2">
              <Bone className="h-8 w-8 !rounded-full" />
              <Bone className="h-8 w-8 !rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function KanbanBones() {
  return (
    <>
      <Card className="space-y-4">
        <Bone className="h-4 w-28 !rounded-lg !shadow-none" />
        <div className="relative ml-3 space-y-6 border-l border-white/10 pl-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bone className="absolute -left-[1.15rem] h-3 w-3 !rounded-full" />
              <Bone className="h-4 w-40 !rounded-lg !shadow-none" />
              <Bone className="h-16 w-full !rounded-xl" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function CalendarBones() {
  return (
    <>
      <Card>
        <Bone className="mb-3 h-4 w-20 !rounded-lg !shadow-none" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} className="h-9 w-28 !rounded-full" />
          ))}
        </div>
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.85fr)]">
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bone key={i} className="h-4 !rounded-md !shadow-none" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="rg-card min-h-20 space-y-2 p-2">
                <Bone className="h-3 w-5 !rounded-md !shadow-none" />
                <Bone className="h-6 w-full !rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <Card className="space-y-3">
          <Bone className="h-4 w-28 !rounded-lg !shadow-none" />
          <Bone className="h-10 !rounded-xl" />
          <Bone className="h-10 !rounded-xl" />
          <Bone className="h-24 !rounded-xl" />
          <Bone className="h-10 !rounded-xl" />
        </Card>
      </div>
    </>
  );
}

function DefaultBones() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="h-28" />
        <Card className="h-28" />
        <Card className="h-28" />
      </div>
      <Card className="space-y-3">
        <Bone className="h-4 w-36 !rounded-lg !shadow-none" />
        <Bone className="h-12 !rounded-xl" />
        <Bone className="h-12 !rounded-xl" />
        <Bone className="h-12 !rounded-xl" />
      </Card>
    </>
  );
}
