import catalogData from "@/lib/or-market-catalog-data.json";
import { kvRead, kvWrite } from "@/lib/app-kv";

export type MarketMetal = "rouge" | "bleu";
export type MarketCategory =
  | "ARMES"
  | "DROGUES"
  | "ACCESSOIRES_ARMES"
  | "ACCESSOIRES";

export type CatalogItem = {
  id: string;
  name: string;
  wikiId: string | null;
  category: MarketCategory;
  price: number;
  metal: MarketMetal;
};

export type WheelTheme = {
  id: string;
  label: string;
  color: string;
  priceMult: number;
  categories: MarketCategory[];
  itemCount: number;
  blurb: string;
};

export type MarketOffer = {
  id: string;
  catalogId: string;
  name: string;
  category: MarketCategory;
  wikiId: string | null;
  basePrice: number;
  price: number;
  priceMult: number;
  imageUrl: string | null;
};

export type OrMarketDraw = {
  weekKey: string;
  metal: MarketMetal;
  themeId: string;
  themeLabel: string;
  themeBlurb: string;
  priceMult: number;
  /** Promo additionnelle appliquée après le thème (0–90) */
  promoPercent: number;
  offers: MarketOffer[];
  /** Thèmes présents sur la roue au moment du tirage */
  wheelThemes?: WheelTheme[];
  spunBy: string | null;
  createdAt: string;
};

export type CartLine = {
  offerId: string;
  catalogId: string;
  name: string;
  category: MarketCategory;
  wikiId: string | null;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  metal: MarketMetal;
};

export type GroupCart = {
  groupId: string;
  groupName: string;
  metal: MarketMetal;
  weekKey: string;
  lines: CartLine[];
  updatedAt: string;
};

export type MarketPurchase = {
  id: string;
  groupId: string;
  groupName: string;
  metal: MarketMetal;
  weekKey: string;
  lines: CartLine[];
  total: number;
  soldBy: string;
  createdAt: string;
};

export const CATEGORY_LABEL: Record<MarketCategory, string> = {
  ARMES: "Armes",
  DROGUES: "Drogues",
  ACCESSOIRES_ARMES: "Accessoires armes",
  ACCESSOIRES: "Autres",
};

export const WHEEL_THEMES_ROUGE: WheelTheme[] = [
  { id: "armes_promo", label: "Armes promo", color: "#e11d48", priceMult: 0.75, categories: ["ARMES", "ACCESSOIRES_ARMES"], itemCount: 8, blurb: "Focus armes · −25 %" },
  { id: "drogues_boom", label: "Drogues boom", color: "#22c55e", priceMult: 1.1, categories: ["DROGUES"], itemCount: 6, blurb: "Darknet · +10 %" },
  { id: "marche_complet", label: "Marché complet", color: "#f59e0b", priceMult: 1, categories: ["ARMES", "DROGUES", "ACCESSOIRES_ARMES", "ACCESSOIRES"], itemCount: 10, blurb: "Un peu de tout" },
  { id: "accessoires", label: "Accessoires", color: "#a78bfa", priceMult: 0.85, categories: ["ACCESSOIRES", "ACCESSOIRES_ARMES"], itemCount: 8, blurb: "Pièces & utilitaires · −15 %" },
  { id: "jackpot_rare", label: "Jackpot rare", color: "#fbbf24", priceMult: 1.35, categories: ["ARMES", "DROGUES"], itemCount: 5, blurb: "Sélection courte · +35 %" },
  { id: "liquidation", label: "Liquidation", color: "#38bdf8", priceMult: 0.55, categories: ["ARMES", "DROGUES", "ACCESSOIRES"], itemCount: 10, blurb: "Soldes · −45 %" },
  { id: "arsenal_lourd", label: "Arsenal lourd", color: "#be123c", priceMult: 1.15, categories: ["ARMES"], itemCount: 7, blurb: "Armes uniquement · +15 %" },
  { id: "marche_pauvre", label: "Marché pauvre", color: "#71717a", priceMult: 0.9, categories: ["ACCESSOIRES", "DROGUES"], itemCount: 5, blurb: "Offre limitée" },
];

export const WHEEL_THEMES_BLEU: WheelTheme[] = [
  { id: "pf_equipement", label: "Équipement PF", color: "#3b82f6", priceMult: 0.8, categories: ["ACCESSOIRES", "ACCESSOIRES_ARMES"], itemCount: 7, blurb: "Matos PF · −20 %" },
  { id: "pf_complet", label: "Marché PF", color: "#0ea5e9", priceMult: 1, categories: ["ARMES", "DROGUES", "ACCESSOIRES_ARMES", "ACCESSOIRES"], itemCount: 8, blurb: "Catalogue mixte" },
  { id: "pf_armes", label: "Armurerie PF", color: "#6366f1", priceMult: 1.05, categories: ["ARMES", "ACCESSOIRES_ARMES"], itemCount: 6, blurb: "Armes & pièces" },
  { id: "pf_soft", label: "Soft market", color: "#67e8f9", priceMult: 0.7, categories: ["ACCESSOIRES", "DROGUES"], itemCount: 6, blurb: "Léger · −30 %" },
  { id: "pf_premium", label: "Premium PF", color: "#818cf8", priceMult: 1.25, categories: ["ARMES", "ACCESSOIRES"], itemCount: 5, blurb: "Sélection courte · +25 %" },
  { id: "pf_liquidation", label: "Liquidation PF", color: "#7dd3fc", priceMult: 0.5, categories: ["ARMES", "DROGUES", "ACCESSOIRES"], itemCount: 9, blurb: "Tout doit partir · −50 %" },
];

const DRAWS_KEY = "refgm.or-market.draws.v2";
const CARTS_KEY = "refgm.or-market.carts.v1";
const PURCHASES_KEY = "refgm.or-market.purchases.v1";
const CUMUL_KEY = "refgm.or-market.cumul.v1";

function readJson<T>(key: string, fallback: T): T {
  return kvRead(key, fallback);
}

function writeJson(key: string, value: unknown) {
  kvWrite(key, value, "refgm:staff-updated");
}

export function currentWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function themesForMetal(metal: MarketMetal): WheelTheme[] {
  return metal === "rouge" ? WHEEL_THEMES_ROUGE : WHEEL_THEMES_BLEU;
}

export function catalogForMetal(metal: MarketMetal): CatalogItem[] {
  const raw = (catalogData as { rouge: CatalogItem[]; bleu: CatalogItem[] })[metal] ?? [];
  return raw as CatalogItem[];
}

/** Images armes GTA via docs.fivem.net */
export function weaponImageUrl(wikiId: string | null | undefined): string | null {
  if (!wikiId) return null;
  const id = wikiId.trim().toUpperCase();
  if (!id.startsWith("WEAPON_")) return null;
  return `https://docs.fivem.net/weapons/${id}.png`;
}

export function categoryFallbackEmoji(category: MarketCategory) {
  switch (category) {
    case "ARMES":
      return "🔫";
    case "DROGUES":
      return "🧪";
    case "ACCESSOIRES_ARMES":
      return "🔧";
    default:
      return "📦";
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function themeIndex(metal: MarketMetal, themeId: string): number {
  return Math.max(0, themesForMetal(metal).findIndex((t) => t.id === themeId));
}

export function buildMarketOffers(
  metal: MarketMetal,
  theme: WheelTheme,
  opts?: { itemCount?: number; promoPercent?: number }
): MarketOffer[] {
  const catalog = catalogForMetal(metal);
  const pool = catalog.filter((i) => theme.categories.includes(i.category));
  const source = pool.length ? pool : catalog;
  const count = Math.min(
    Math.max(1, opts?.itemCount ?? theme.itemCount),
    source.length
  );
  const picked = shuffle(source).slice(0, count);
  const promo = Math.min(90, Math.max(0, opts?.promoPercent ?? 0));
  const promoMult = 1 - promo / 100;

  return picked.map((item) => {
    const themePrice = Math.max(1, Math.round(item.price * theme.priceMult));
    const price = Math.max(1, Math.round(themePrice * promoMult));
    return {
      id: `${theme.id}-${item.id}`,
      catalogId: item.id,
      name: item.name,
      category: item.category,
      wikiId: item.wikiId,
      basePrice: item.price,
      price,
      priceMult: Number((theme.priceMult * promoMult).toFixed(3)),
      imageUrl: weaponImageUrl(item.wikiId),
    };
  });
}

export function getDraw(weekKey: string, metal: MarketMetal): OrMarketDraw | null {
  return (
    readJson<OrMarketDraw[]>(DRAWS_KEY, []).find(
      (d) => d.weekKey === weekKey && d.metal === metal
    ) ?? null
  );
}

export function spinMarketTheme(input: {
  weekKey: string;
  metal: MarketMetal;
  spunBy: string | null;
  /** Nombre de cases sur la roue (sous-ensemble aléatoire des thèmes) */
  wheelSlots?: number;
  /** Nombre d’articles dans la boutique */
  itemCount?: number;
  /** Promo supplémentaire en % */
  promoPercent?: number;
}): { draw: OrMarketDraw; themeIndex: number; wheelThemes: WheelTheme[] } {
  const allThemes = themesForMetal(input.metal);
  const slots = Math.min(
    allThemes.length,
    Math.max(2, input.wheelSlots ?? allThemes.length)
  );
  const wheelThemes = shuffle(allThemes).slice(0, slots);
  const index = Math.floor(Math.random() * wheelThemes.length);
  const theme = wheelThemes[index]!;
  const promoPercent = Math.min(90, Math.max(0, input.promoPercent ?? 0));
  const offers = buildMarketOffers(input.metal, theme, {
    itemCount: input.itemCount,
    promoPercent,
  });
  const draw: OrMarketDraw = {
    weekKey: input.weekKey,
    metal: input.metal,
    themeId: theme.id,
    themeLabel: theme.label,
    themeBlurb: theme.blurb,
    priceMult: theme.priceMult,
    promoPercent,
    offers,
    wheelThemes,
    spunBy: input.spunBy,
    createdAt: new Date().toISOString(),
  };
  const others = readJson<OrMarketDraw[]>(DRAWS_KEY, []).filter(
    (d) => !(d.weekKey === input.weekKey && d.metal === input.metal)
  );
  writeJson(DRAWS_KEY, [draw, ...others]);
  return { draw, themeIndex: index, wheelThemes };
}

/** Applique / met à jour une promo sur le tirage courant (recalcule les prix) */
export function applyPromoToDraw(input: {
  weekKey: string;
  metal: MarketMetal;
  promoPercent: number;
}): OrMarketDraw | null {
  const draw = getDraw(input.weekKey, input.metal);
  if (!draw) return null;
  const themes = themesForMetal(input.metal);
  const theme =
    themes.find((t) => t.id === draw.themeId) ??
    draw.wheelThemes?.find((t) => t.id === draw.themeId);
  if (!theme) return null;
  const promoPercent = Math.min(90, Math.max(0, input.promoPercent));
  const offers = buildMarketOffers(input.metal, theme, {
    itemCount: draw.offers.length,
    promoPercent,
  });
  // Conserve les noms déjà tirés si possible
  const byCatalog = new Map(offers.map((o) => [o.catalogId, o]));
  const remapped = draw.offers.map((old) => {
    const next = byCatalog.get(old.catalogId);
    if (!next) return old;
    return { ...next, id: old.id };
  });
  const updated: OrMarketDraw = {
    ...draw,
    promoPercent,
    offers: remapped,
  };
  const others = readJson<OrMarketDraw[]>(DRAWS_KEY, []).filter(
    (d) => !(d.weekKey === input.weekKey && d.metal === input.metal)
  );
  writeJson(DRAWS_KEY, [updated, ...others]);
  return updated;
}

/* ——— Carts ——— */
export function listCarts(weekKey: string, metal: MarketMetal): GroupCart[] {
  return readJson<GroupCart[]>(CARTS_KEY, []).filter(
    (c) => c.weekKey === weekKey && c.metal === metal
  );
}

export function getCart(
  weekKey: string,
  metal: MarketMetal,
  groupId: string
): GroupCart | null {
  return (
    listCarts(weekKey, metal).find((c) => c.groupId === groupId) ?? null
  );
}

export function upsertCartLine(input: {
  weekKey: string;
  metal: MarketMetal;
  groupId: string;
  groupName: string;
  offer: MarketOffer;
  qtyDelta?: number;
  /** Quantité absolue (écrase) */
  qtySet?: number;
}): GroupCart {
  const all = readJson<GroupCart[]>(CARTS_KEY, []);
  const idx = all.findIndex(
    (c) =>
      c.weekKey === input.weekKey &&
      c.metal === input.metal &&
      c.groupId === input.groupId
  );
  const cart: GroupCart =
    idx >= 0
      ? all[idx]!
      : {
          groupId: input.groupId,
          groupName: input.groupName,
          metal: input.metal,
          weekKey: input.weekKey,
          lines: [],
          updatedAt: new Date().toISOString(),
        };

  const lineIdx = cart.lines.findIndex((l) => l.offerId === input.offer.id);
  if (input.qtySet != null) {
    const qty = Math.floor(input.qtySet);
    if (qty <= 0) {
      if (lineIdx >= 0) cart.lines.splice(lineIdx, 1);
    } else if (lineIdx >= 0) {
      cart.lines[lineIdx] = {
        ...cart.lines[lineIdx]!,
        qty,
        unitPrice: input.offer.price,
      };
    } else {
      cart.lines.push({
        offerId: input.offer.id,
        catalogId: input.offer.catalogId,
        name: input.offer.name,
        category: input.offer.category,
        wikiId: input.offer.wikiId,
        imageUrl: input.offer.imageUrl,
        unitPrice: input.offer.price,
        qty,
        metal: input.metal,
      });
    }
  } else {
    const delta = input.qtyDelta ?? 1;
    if (lineIdx >= 0) {
      const nextQty = cart.lines[lineIdx]!.qty + delta;
      if (nextQty <= 0) {
        cart.lines.splice(lineIdx, 1);
      } else {
        cart.lines[lineIdx] = { ...cart.lines[lineIdx]!, qty: nextQty };
      }
    } else if (delta > 0) {
      cart.lines.push({
        offerId: input.offer.id,
        catalogId: input.offer.catalogId,
        name: input.offer.name,
        category: input.offer.category,
        wikiId: input.offer.wikiId,
        imageUrl: input.offer.imageUrl,
        unitPrice: input.offer.price,
        qty: delta,
        metal: input.metal,
      });
    }
  }

  cart.groupName = input.groupName;
  cart.updatedAt = new Date().toISOString();

  if (idx >= 0) all[idx] = cart;
  else all.unshift(cart);
  writeJson(CARTS_KEY, all);
  return cart;
}

/** Ajoute le même article (qty) aux paniers de plusieurs groupes */
export function upsertCartLineForGroups(input: {
  weekKey: string;
  metal: MarketMetal;
  groups: { id: string; name: string }[];
  offer: MarketOffer;
  qty: number;
}): GroupCart[] {
  const qty = Math.max(1, Math.floor(input.qty));
  return input.groups.map((g) =>
    upsertCartLine({
      weekKey: input.weekKey,
      metal: input.metal,
      groupId: g.id,
      groupName: g.name,
      offer: input.offer,
      qtyDelta: qty,
    })
  );
}

export function clearCart(weekKey: string, metal: MarketMetal, groupId: string) {
  writeJson(
    CARTS_KEY,
    readJson<GroupCart[]>(CARTS_KEY, []).filter(
      (c) =>
        !(
          c.weekKey === weekKey &&
          c.metal === metal &&
          c.groupId === groupId
        )
    )
  );
}

export function cartTotal(cart: GroupCart | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

export function checkoutCart(input: {
  weekKey: string;
  metal: MarketMetal;
  groupId: string;
  groupName: string;
  soldBy: string;
}): MarketPurchase | null {
  const cart = getCart(input.weekKey, input.metal, input.groupId);
  if (!cart || cart.lines.length === 0) return null;
  const purchase: MarketPurchase = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    groupName: input.groupName,
    metal: input.metal,
    weekKey: input.weekKey,
    lines: cart.lines,
    total: cartTotal(cart),
    soldBy: input.soldBy,
    createdAt: new Date().toISOString(),
  };
  const purchases = readJson<MarketPurchase[]>(PURCHASES_KEY, []);
  writeJson(PURCHASES_KEY, [purchase, ...purchases]);
  clearCart(input.weekKey, input.metal, input.groupId);

  // Ajoute au cumul hebdo
  const cumul = getWeekCumul(input.weekKey);
  if (input.metal === "rouge") {
    saveWeekCumul(input.weekKey, { rouge: cumul.rouge + purchase.total });
  } else {
    saveWeekCumul(input.weekKey, { bleu: cumul.bleu + purchase.total });
  }
  return purchase;
}

export function listPurchases(weekKey: string, metal?: MarketMetal): MarketPurchase[] {
  return readJson<MarketPurchase[]>(PURCHASES_KEY, [])
    .filter((p) => p.weekKey === weekKey && (!metal || p.metal === metal))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function listAllPurchases(metal?: MarketMetal): MarketPurchase[] {
  return readJson<MarketPurchase[]>(PURCHASES_KEY, [])
    .filter((p) => !metal || p.metal === metal)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/* ——— Cumuls ——— */
export type WeeklyOrCumul = {
  weekKey: string;
  rouge: number;
  bleu: number;
  note: string;
  updatedAt: string;
};

export function getWeekCumul(weekKey: string): WeeklyOrCumul {
  return (
    readJson<WeeklyOrCumul[]>(CUMUL_KEY, []).find((c) => c.weekKey === weekKey) ?? {
      weekKey,
      rouge: 0,
      bleu: 0,
      note: "",
      updatedAt: new Date().toISOString(),
    }
  );
}

export function saveWeekCumul(
  weekKey: string,
  patch: Partial<Pick<WeeklyOrCumul, "rouge" | "bleu" | "note">>
): WeeklyOrCumul {
  const current = getWeekCumul(weekKey);
  const next: WeeklyOrCumul = {
    ...current,
    ...patch,
    weekKey,
    updatedAt: new Date().toISOString(),
  };
  writeJson(CUMUL_KEY, [
    next,
    ...readJson<WeeklyOrCumul[]>(CUMUL_KEY, []).filter((c) => c.weekKey !== weekKey),
  ]);
  return next;
}

export function listRecentCumuls(limit = 8): WeeklyOrCumul[] {
  return readJson<WeeklyOrCumul[]>(CUMUL_KEY, [])
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, limit);
}
