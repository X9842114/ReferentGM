"use client";

import { OrIcon } from "@/components/or-icon";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  FLASHBACK_SHEETS,
  sheetEditUrl,
  type FlashbackSheetPayload,
} from "@/lib/flashback-sheets";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function cellLooksNumeric(value: string) {
  return /^-?\d+([.,]\d+)?%?$/.test(value.replace(/\s/g, ""));
}

export function FlashbackSheetsHub({
  initialSlug,
}: {
  initialSlug?: string;
}) {
  const router = useRouter();
  const [sheets, setSheets] = useState<FlashbackSheetPayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(
    initialSlug && FLASHBACK_SHEETS.some((s) => s.slug === initialSlug)
      ? initialSlug
      : FLASHBACK_SHEETS[0].slug
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tableaux")
      .then(async (response) => {
        if (!response.ok) throw new Error("fetch");
        return (await response.json()) as { sheets: FlashbackSheetPayload[] };
      })
      .then((payload) => {
        if (!cancelled) setSheets(payload.sheets);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les tableaux.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current =
    sheets?.find((sheet) => sheet.slug === slug) ??
    FLASHBACK_SHEETS.find((sheet) => sheet.slug === slug) ??
    FLASHBACK_SHEETS[0];

  const rows: string[][] =
    "rows" in current && Array.isArray(current.rows) ? current.rows : [];

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query))
    );
  }, [rows, q]);

  return (
    <StaffPageShell
      className="max-w-6xl"
      title="Tableaux"
      description="Récompenses GM et prix du marché noir, affichés ici. Plus besoin d’ouvrir Google."
      backHref="/dashboard/administration"
      backLabel="Admin"
    >
      <div className="flex flex-wrap gap-2">
        {FLASHBACK_SHEETS.map((sheet) => (
          <button
            key={sheet.slug}
            type="button"
            onClick={() => {
              setSlug(sheet.slug);
              setQ("");
              router.replace(`/dashboard/tableaux/${sheet.slug}`, {
                scroll: false,
              });
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              slug === sheet.slug
                ? "border-white/25 bg-white text-black"
                : "border-white/10 text-white/50 hover:text-white"
            )}
          >
            <OrIcon color={sheet.metal} className="h-3.5 w-3.5" />
            {sheet.kind === "recompense" ? "Récompense" : "Marché"}{" "}
            {sheet.metal === "rouge" ? "Rouge" : "Bleu"}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{current.title}</h2>
            <p className="text-xs text-white/40">{current.hint}</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrer une ligne…"
              className="rg-field rg-field-icon py-2 pr-3"
            />
          </div>
        </div>

        {error ? (
          <div className="rg-empty">
            <p className="text-sm text-white/50">{error}</p>
          </div>
        ) : sheets === null ? (
          <div className="rg-empty">
            <p className="text-sm text-white/50">Chargement des tableaux…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rg-empty">
            <p className="text-sm text-white/50">Aucune ligne</p>
          </div>
        ) : (
          <div className="rg-card overflow-x-auto p-0">
            <table className="min-w-full border-collapse text-left text-xs">
              <tbody>
                {filtered.map((row, rowIndex) => (
                  <tr
                    key={`${slug}-${rowIndex}`}
                    className="border-b border-white/[0.06] last:border-b-0"
                  >
                    {row.map((cell, colIndex) => (
                      <td
                        key={`${rowIndex}-${colIndex}`}
                        className={cn(
                          "max-w-[16rem] px-3 py-2 align-top whitespace-pre-wrap text-white/75",
                          rowIndex < 3 && "font-medium text-white",
                          cellLooksNumeric(cell) && "font-mono text-white/90"
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-white/30">
          Données lues depuis le fichier officiel.{" "}
          <a
            href={sheetEditUrl(current.sheetId)}
            target="_blank"
            rel="noreferrer"
            className="text-white/45 underline-offset-2 hover:text-white hover:underline"
          >
            Source Google
          </a>
        </p>
      </section>
    </StaffPageShell>
  );
}
