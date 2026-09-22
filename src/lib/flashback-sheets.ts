export type FlashbackSheet = {
  slug: string;
  title: string;
  hint: string;
  sheetId: string;
  metal: "rouge" | "bleu";
  kind: "recompense" | "marche";
};

export const FLASHBACK_SHEETS: FlashbackSheet[] = [
  {
    slug: "recompense-orga-gang",
    title: "Récompense GM Orga / Gang",
    hint: "Barème missions, Or Rouge",
    sheetId: "1FI0PLu1o34skyOFC_sYWxknVRywYIYZvV7rMlD9_aNU",
    metal: "rouge",
    kind: "recompense",
  },
  {
    slug: "marche-noir-or-rouge",
    title: "Prix Marché Noir, Or Rouge",
    hint: "Armes, accessoires, darknet",
    sheetId: "1LzFeaj8HifRG27E7hgZBZ68slNNaO9lnPKAbZt04apI",
    metal: "rouge",
    kind: "marche",
  },
  {
    slug: "recompense-pf",
    title: "Récompense GM PF Officiel / Indépendant",
    hint: "Barème missions, Or Bleu",
    sheetId: "1VIvWoYtlolt9GHjRK6cape2aPEsiHawv-p0CbL51CHM",
    metal: "bleu",
    kind: "recompense",
  },
  {
    slug: "marche-noir-or-bleu",
    title: "Prix Marché Noir, Or Bleu",
    hint: "Armes, accessoires, darknet",
    sheetId: "1ZmPQWQdeEVeGbb1-48t5y-fBX1P-eCbEXsaGa-z9IE8",
    metal: "bleu",
    kind: "marche",
  },
];

export function getFlashbackSheet(slug: string) {
  return FLASHBACK_SHEETS.find((sheet) => sheet.slug === slug) ?? null;
}

export type FlashbackSheetPayload = FlashbackSheet & {
  rows: string[][];
};

export function sheetEditUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
}

export function sheetCsvUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return trimCsvGrid(rows);
}

function trimCsvGrid(rows: string[][]): string[][] {
  const cleaned = rows.map((row) => row.map((cell) => cell.replace(/\u00a0/g, " ").trim()));
  let maxCol = 0;
  let lastRow = -1;
  for (let r = 0; r < cleaned.length; r++) {
    for (let c = 0; c < cleaned[r].length; c++) {
      if (cleaned[r][c]) {
        maxCol = Math.max(maxCol, c + 1);
        lastRow = r;
      }
    }
  }
  if (lastRow < 0) return [];
  return cleaned.slice(0, lastRow + 1).map((row) => {
    const next = row.slice(0, maxCol);
    while (next.length < maxCol) next.push("");
    return next;
  });
}
