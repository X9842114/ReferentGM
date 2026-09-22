import { auth } from "@/auth";
import {
  FLASHBACK_SHEETS,
  parseCsv,
  sheetCsvUrl,
  type FlashbackSheetPayload,
} from "@/lib/flashback-sheets";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }

  const sheets = await Promise.all(
    FLASHBACK_SHEETS.map(async (sheet): Promise<FlashbackSheetPayload> => {
      try {
        const response = await fetch(sheetCsvUrl(sheet.sheetId), {
          headers: { "User-Agent": "Mozilla/5.0 RefGM" },
          next: { revalidate: 300 },
        });
        if (!response.ok) {
          return { ...sheet, rows: [] };
        }
        const csv = await response.text();
        return { ...sheet, rows: parseCsv(csv) };
      } catch {
        return { ...sheet, rows: [] };
      }
    })
  );

  return Response.json({ sheets });
}
