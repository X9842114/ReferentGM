import type { MarketMetal, OrMarketDraw } from "@/lib/or-market";

/** Affiche / télécharge une affiche boutique pour le jeu / Discord. */
export async function exportMarketPoster(draw: OrMarketDraw): Promise<void> {
  const w = 1080;
  const h = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isRouge = draw.metal === "rouge";
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (isRouge) {
    grad.addColorStop(0, "#1a0508");
    grad.addColorStop(0.45, "#3f0a14");
    grad.addColorStop(1, "#0a0a0b");
  } else {
    grad.addColorStop(0, "#041018");
    grad.addColorStop(0.45, "#0b2a44");
    grad.addColorStop(1, "#0a0a0b");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Cadre
  ctx.strokeStyle = isRouge ? "rgba(244,63,94,0.45)" : "rgba(56,189,248,0.45)";
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  ctx.fillStyle = "#fff";
  ctx.font = "700 54px system-ui, sans-serif";
  ctx.fillText("MARCHÉ OR", 80, 120);
  ctx.font = "500 32px system-ui, sans-serif";
  ctx.fillStyle = isRouge ? "#fda4af" : "#7dd3fc";
  ctx.fillText(isRouge ? "OR ROUGE" : "OR BLEU", 80, 170);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 36px system-ui, sans-serif";
  ctx.fillText(draw.themeLabel, 80, 240);
  ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(draw.themeBlurb, 80, 280);

  if (draw.promoPercent > 0) {
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    roundRect(ctx, 780, 90, 220, 64, 16);
    ctx.fill();
    ctx.fillStyle = "#052e16";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText(`−${draw.promoPercent} %`, 820, 132);
  }

  const colW = (w - 160) / 2;
  const y = 340;
  draw.offers.slice(0, 10).forEach((offer, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 80 + col * (colW + 20);
    const yy = y + row * 170;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, x, yy, colW, 150, 20);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 26px system-ui, sans-serif";
    const name =
      offer.name.length > 28 ? `${offer.name.slice(0, 26)}…` : offer.name;
    ctx.fillText(name, x + 24, yy + 48);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText(offer.category.replace("_", " "), x + 24, yy + 80);

    ctx.fillStyle = "#fff";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(`${offer.price} Or`, x + 24, yy + 124);

    if (offer.basePrice !== offer.price) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "400 20px system-ui, sans-serif";
      ctx.fillText(`au lieu de ${offer.basePrice}`, x + 160, yy + 122);
    }
  });

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "400 20px system-ui, sans-serif";
  ctx.fillText(`Semaine ${draw.weekKey} · RefGM`, 80, h - 70);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marche-or-${draw.metal}-${draw.weekKey}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type { MarketMetal };
