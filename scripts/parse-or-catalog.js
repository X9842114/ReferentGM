const fs = require("fs");
const path = require("path");

const TEMP = process.env.TEMP;

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        q = !q;
        continue;
      }
      if (c === "," && !q) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function parse(file, metal) {
  const text = fs.readFileSync(path.join(TEMP, file), "utf8");
  const rows = parseCsv(text);
  const groups = [
    [1, 2, 3, "ARMES"],
    [5, 6, 7, "ACCESSOIRES_ARMES"],
    [9, 10, 11, "ACCESSOIRES"],
    [13, 14, 15, "DROGUES"],
  ];
  const items = [];
  for (const row of rows.slice(3)) {
    for (const [pc, nc, ic, cat] of groups) {
      if (row.length <= Math.max(pc, nc, ic)) continue;
      const price = (row[pc] || "").trim().replace(/ /g, "");
      const name = (row[nc] || "").trim();
      const wid = (row[ic] || "").trim();
      if (!name || !price) continue;
      const digits = price.replace(/[^\d]/g, "");
      if (!digits) continue;
      const p = Number(digits);
      if (p <= 0) continue;
      const slug = (wid || name)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_");
      items.push({
        id: `${metal}-${slug}`,
        name,
        wikiId: wid || null,
        category: cat,
        price: p,
        metal,
      });
    }
  }
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.name.toUpperCase()}|${it.price}|${it.category}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

const rouge = parse("or-rouge.csv", "rouge");
const bleu = parse("or-bleu.csv", "bleu");
const out = "C:/Users/Shadow/cveshop/src/lib/or-market-catalog-data.json";
fs.writeFileSync(out, JSON.stringify({ rouge, bleu }, null, 2));
console.log("rouge", rouge.length, "bleu", bleu.length);
