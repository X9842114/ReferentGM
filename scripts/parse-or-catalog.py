import csv
import json
import os
import re
from pathlib import Path

TEMP = os.environ["TEMP"]


def parse(path: str, metal: str):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    rows = list(csv.reader(text.splitlines()))
    items = []
    groups = [
        (1, 2, 3, "ARMES"),
        (5, 6, 7, "ACCESSOIRES_ARMES"),
        (9, 10, 11, "ACCESSOIRES"),
        (13, 14, 15, "DROGUES"),
    ]
    for row in rows[3:]:
        if not row:
            continue
        for pc, nc, ic, cat in groups:
            if len(row) <= max(pc, nc, ic):
                continue
            price = (row[pc] or "").strip().replace(" ", "")
            name = (row[nc] or "").strip()
            wid = (row[ic] or "").strip()
            if not name or not price:
                continue
            digits = re.sub(r"[^\d]", "", price)
            if not digits:
                continue
            p = int(digits)
            if p <= 0:
                continue
            slug = re.sub(r"[^a-z0-9_]+", "_", (wid or name).lower())
            items.append(
                {
                    "id": f"{metal}-{slug}",
                    "name": name,
                    "wikiId": wid or None,
                    "category": cat,
                    "price": p,
                    "metal": metal,
                }
            )
    seen = set()
    out = []
    for it in items:
        key = (it["name"].upper(), it["price"], it["category"])
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


rouge = parse(os.path.join(TEMP, "or-rouge.csv"), "rouge")
bleu = parse(os.path.join(TEMP, "or-bleu.csv"), "bleu")
out = Path(r"C:\Users\Shadow\cveshop\src\lib\or-market-catalog-data.json")
out.write_text(
    json.dumps({"rouge": rouge, "bleu": bleu}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print("rouge", len(rouge), "bleu", len(bleu), "->", out)
