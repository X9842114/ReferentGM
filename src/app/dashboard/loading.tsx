"use client";

import {
  PageSkeleton,
  skeletonVariantForPath,
} from "@/components/page-skeleton";
import { usePathname } from "next/navigation";

export default function DashboardLoading() {
  const pathname = usePathname();
  return <PageSkeleton variant={skeletonVariantForPath(pathname)} />;
}
