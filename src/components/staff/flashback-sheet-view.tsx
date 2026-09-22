"use client";

import { FlashbackSheetsHub } from "@/components/staff/flashback-sheets-hub";

export function FlashbackSheetView({ slug }: { slug: string }) {
  return <FlashbackSheetsHub initialSlug={slug} />;
}
