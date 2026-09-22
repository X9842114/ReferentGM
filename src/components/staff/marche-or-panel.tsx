"use client";

import { useAccount } from "@/components/account-context";
import { OrIcon } from "@/components/or-icon";
import {
  OrMarketWheel,
  useWheelSpin,
} from "@/components/staff/or-market-wheel";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  applyPromoToDraw,
  cartTotal,
  catalogForMetal,
  CATEGORY_LABEL,
  categoryFallbackEmoji,
  checkoutCart,
  clearCart,
  currentWeekKey,
  getCart,
  getDraw,
  getWeekCumul,
  listCarts,
  listPurchases,
  spinMarketTheme,
  themesForMetal,
  upsertCartLine,
  upsertCartLineForGroups,
  type GroupCart,
  type MarketMetal,
  type MarketOffer,
  type MarketPurchase,
  type OrMarketDraw,
  type WheelTheme,
} from "@/lib/or-market";
import { exportMarketPoster } from "@/lib/or-market-poster";
import { canAccessStaffTools } from "@/lib/permissions";
import { GROUP_KIND_LABEL, listRpGroups } from "@/lib/rp-groups";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  ImageIcon,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function OfferCard({
  offer,
  metal,
  qty,
  onQty,
  onAdd,
  disabled,
}: {
  offer: MarketOffer;
  metal: MarketMetal;
  qty: number;
  onQty: (n: number) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const [imgOk, setImgOk] = useState(Boolean(offer.imageUrl));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
        metal === "rouge"
          ? "border-rose-400/20 hover:border-rose-400/40"
          : "border-sky-400/20 hover:border-sky-400/40"
      )}
    >
      <div className="relative flex h-36 items-center justify-center bg-black/40">
        {imgOk && offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offer.imageUrl}
            alt=""
            className="max-h-28 max-w-[85%] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-105"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="text-4xl opacity-70">
            {categoryFallbackEmoji(offer.category)}
          </span>
        )}
        <span className="absolute top-2 left-2 rounded-md border border-white/10 bg-black/55 px-2 py-0.5 text-[10px] tracking-wide text-white/55 uppercase">
          {CATEGORY_LABEL[offer.category]}
        </span>
        {offer.basePrice !== offer.price ? (
          <span className="absolute top-2 right-2 rounded-md bg-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
            Promo
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium text-white/90">
          {offer.name}
        </h3>
        <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-white">
          <OrIcon color={metal} className="h-4 w-4" />
          {offer.price}
          {offer.basePrice !== offer.price ? (
            <span className="text-[11px] font-normal text-white/30 line-through">
              {offer.basePrice}
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-white/40">
            Qté
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                onQty(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-14 rounded-lg border border-white/10 bg-black/40 px-1.5 py-1 text-center text-xs text-white outline-none"
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={onAdd}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-40",
              metal === "rouge"
                ? "bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                : "bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Panier
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export function MarcheOrPanel() {
  const { account, grade } = useAccount();
  const canManage = canAccessStaffTools(grade);
  const week = currentWeekKey();
  const [metal, setMetal] = useState<MarketMetal>("rouge");
  const [draw, setDraw] = useState<OrMarketDraw | null>(() =>
    getDraw(week, "rouge")
  );
  const [wheelSlots, setWheelSlots] = useState(6);
  const [itemCount, setItemCount] = useState(8);
  const [promoPercent, setPromoPercent] = useState(0);
  const [addQty, setAddQty] = useState<Record<string, number>>({});
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [focusGroupId, setFocusGroupId] = useState("");
  const [cart, setCart] = useState<GroupCart | null>(null);
  const [allCarts, setAllCarts] = useState<GroupCart[]>([]);
  const [purchases, setPurchases] = useState<MarketPurchase[]>([]);
  const [cumul, setCumul] = useState(() => getWeekCumul(week));
  const [toast, setToast] = useState<string | null>(null);
  const [wheelThemes, setWheelThemes] = useState<WheelTheme[]>([]);
  const rougeSpin = useWheelSpin();
  const bleuSpin = useWheelSpin();
  const spinState = metal === "rouge" ? rougeSpin : bleuSpin;

  const groupsForMetal = useMemo(() => {
    if (metal === "bleu") return listRpGroups().filter((g) => g.kind === "PF");
    return listRpGroups().filter((g) => g.kind === "GANG" || g.kind === "ORGA");
  }, [metal]);

  const catalogCount = catalogForMetal(metal).length;
  const maxSlots = themesForMetal(metal).length;

  function refresh() {
    setDraw(getDraw(week, metal));
    setCumul(getWeekCumul(week));
    setPurchases(listPurchases(week, metal));
    setAllCarts(listCarts(week, metal));
    if (focusGroupId) setCart(getCart(week, metal, focusGroupId));
  }

  useEffect(() => {
    setSelectedGroupIds(groupsForMetal.map((g) => g.id));
    setFocusGroupId(groupsForMetal[0]?.id ?? "");
  }, [groupsForMetal]);

  useEffect(() => {
    refresh();
    const d = getDraw(week, metal);
    if (d?.wheelThemes?.length) setWheelThemes(d.wheelThemes);
    else setWheelThemes(themesForMetal(metal).slice(0, wheelSlots));
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    return () => window.removeEventListener("refgm:staff-updated", onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metal, week, focusGroupId]);

  useEffect(() => {
    if (draw?.themeId && wheelThemes.length) {
      spinState.setResultIndex(
        Math.max(0, wheelThemes.findIndex((t) => t.id === draw.themeId))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw?.themeId, metal, wheelThemes]);

  async function onSpin() {
    if (!canManage || spinState.spinning) return;
    const { draw: next, themeIndex, wheelThemes: wt } = spinMarketTheme({
      weekKey: week,
      metal,
      spunBy: account.displayName,
      wheelSlots,
      itemCount,
      promoPercent,
    });
    setWheelThemes(wt);
    await spinState.runSpin(themeIndex);
    setDraw(next);
    setToast(`Boutique ${metal === "rouge" ? "Or Rouge" : "Or Bleu"} : ${next.themeLabel}`);
  }

  function applyPromo() {
    if (!canManage) return;
    const next = applyPromoToDraw({ weekKey: week, metal, promoPercent });
    if (next) {
      setDraw(next);
      setToast(`Promo −${promoPercent}% appliquée à toute la boutique`);
    }
  }

  function addToCart(offer: MarketOffer) {
    if (!canManage) return;
    const qty = addQty[offer.id] ?? 1;
    const groups = groupsForMetal.filter((g) =>
      selectedGroupIds.includes(g.id)
    );
    if (!groups.length) {
      setToast("Sélectionne au moins un groupe");
      return;
    }
    upsertCartLineForGroups({
      weekKey: week,
      metal,
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      offer,
      qty,
    });
    refresh();
    setToast(
      `${offer.name} ×${qty} → ${groups.length} groupe${groups.length > 1 ? "s" : ""}`
    );
  }

  function changeQty(offerId: string, absolute: number) {
    if (!canManage || !focusGroupId || !cart) return;
    const line = cart.lines.find((l) => l.offerId === offerId);
    if (!line) return;
    const group = groupsForMetal.find((g) => g.id === focusGroupId);
    if (!group) return;
    const offer: MarketOffer = {
      id: line.offerId,
      catalogId: line.catalogId,
      name: line.name,
      category: line.category,
      wikiId: line.wikiId,
      basePrice: line.unitPrice,
      price: line.unitPrice,
      priceMult: 1,
      imageUrl: line.imageUrl,
    };
    const next = upsertCartLine({
      weekKey: week,
      metal,
      groupId: group.id,
      groupName: group.name,
      offer,
      qtySet: absolute,
    });
    setCart(next.lines.length ? next : null);
    setAllCarts(listCarts(week, metal));
  }

  function confirmSale() {
    if (!canManage || !focusGroupId) return;
    const group = groupsForMetal.find((g) => g.id === focusGroupId);
    if (!group) return;
    const purchase = checkoutCart({
      weekKey: week,
      metal,
      groupId: group.id,
      groupName: group.name,
      soldBy: account.displayName,
    });
    if (!purchase) return;
    setCart(null);
    refresh();
    setToast(`Vente ${purchase.total} → ${group.name}`);
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const offers = draw?.offers ?? [];
  const total = cartTotal(cart);
  const displayThemes =
    wheelThemes.length > 0
      ? wheelThemes
      : themesForMetal(metal).slice(0, wheelSlots);

  return (
    <StaffPageShell
      title="Marché Or"
      description={`Boutique partagée tous groupes · roue configurable · promo · affiche jeu · semaine ${week}`}
      className="max-w-6xl"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 right-6 z-50 rounded-xl border border-white/15 bg-black/80 px-4 py-2 text-sm text-white/90 shadow-xl backdrop-blur"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        {(["rouge", "bleu"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetal(m)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm",
              metal === m
                ? m === "rouge"
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                  : "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-white/45 hover:text-white/70"
            )}
          >
            <OrIcon color={m} />
            Or {m === "rouge" ? "Rouge" : "Bleu"}
            <span className="text-[10px] text-white/35">
              {catalogForMetal(m).length} items
            </span>
          </button>
        ))}
        <div className="ml-auto rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
          Cumul ·{" "}
          <span className="text-rose-200/90">{cumul.rouge} rouge</span>
          {" · "}
          <span className="text-sky-200/90">{cumul.bleu} bleu</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-3">
        <label className="text-[11px] text-white/40">
          Cases sur la roue
          <input
            type="number"
            min={2}
            max={maxSlots}
            value={wheelSlots}
            onChange={(e) =>
              setWheelSlots(
                Math.min(maxSlots, Math.max(2, Number(e.target.value) || 2))
              )
            }
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="text-[11px] text-white/40">
          Articles en boutique
          <input
            type="number"
            min={3}
            max={Math.min(20, catalogCount)}
            value={itemCount}
            onChange={(e) =>
              setItemCount(
                Math.min(
                  Math.min(20, catalogCount),
                  Math.max(3, Number(e.target.value) || 3)
                )
              )
            }
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="text-[11px] text-white/40">
          Promo boutique (%)
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              max={90}
              value={promoPercent}
              onChange={(e) =>
                setPromoPercent(
                  Math.min(90, Math.max(0, Number(e.target.value) || 0))
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              disabled={!canManage || !draw}
              onClick={applyPromo}
              className="shrink-0 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 text-xs text-emerald-100 disabled:opacity-40"
            >
              Appliquer
            </button>
          </div>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="mb-3 text-center text-[11px] tracking-wide text-white/40 uppercase">
            Roue {metal === "rouge" ? "Or Rouge" : "Or Bleu"}
          </p>
          <OrMarketWheel
            themes={displayThemes}
            spinning={spinState.spinning}
            resultIndex={spinState.resultIndex}
            accent={metal}
            onSpin={() => void onSpin()}
            disabled={!canManage}
          />
          {draw ? (
            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-center">
                <p className="text-sm font-medium text-amber-100">
                  {draw.themeLabel}
                </p>
                <p className="mt-1 text-[11px] text-white/40">{draw.themeBlurb}</p>
                <p className="mt-1 text-[10px] text-white/30">
                  {draw.offers.length} articles
                  {draw.promoPercent > 0
                    ? ` · promo −${draw.promoPercent}%`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => void exportMarketPoster(draw)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.08]"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <Download className="h-3.5 w-3.5" />
                Affiche pour le jeu (PNG)
              </button>
            </div>
          ) : (
            <p className="mt-4 text-center text-xs text-white/35">
              Tire la roue pour générer la boutique (identique pour tous les
              groupes).
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium text-white/90">
              <ShoppingBag className="h-4 w-4 text-white/45" />
              Boutique de la semaine
            </h2>
            <p className="mt-1 text-xs text-white/40">
              Une seule boutique pour tous les groupes · coche ceux qui
              reçoivent l’ajout panier
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSelectedGroupIds(groupsForMetal.map((g) => g.id))
              }
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/45 hover:text-white/80"
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroupIds([])}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/45 hover:text-white/80"
            >
              Aucun
            </button>
            {groupsForMetal.map((g) => {
              const on = selectedGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    setSelectedGroupIds((prev) =>
                      on ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                    )
                  }
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[10px]",
                    on
                      ? metal === "rouge"
                        ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
                        : "border-violet-400/40 bg-violet-500/15 text-violet-100"
                      : "border-white/10 text-white/35"
                  )}
                >
                  [{GROUP_KIND_LABEL[g.kind]}] {g.name}
                </button>
              );
            })}
          </div>

          {offers.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/35">
              Aucun article. Lance la roue
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  metal={metal}
                  qty={addQty[offer.id] ?? 1}
                  onQty={(n) =>
                    setAddQty((prev) => ({ ...prev, [offer.id]: n }))
                  }
                  disabled={!canManage}
                  onAdd={() => addToCart(offer)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white/90">
              <ShoppingCart className="h-4 w-4" />
              Paniers par groupe
            </h3>
            <select
              value={focusGroupId}
              onChange={(e) => setFocusGroupId(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none"
            >
              {groupsForMetal.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {listCarts(week, metal).find((c) => c.groupId === g.id)
                    ? " · panier"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {groupsForMetal.map((g) => {
              const c = allCarts.find((x) => x.groupId === g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setFocusGroupId(g.id)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[10px]",
                    focusGroupId === g.id
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 text-white/35",
                    c && c.lines.length > 0 && "text-emerald-200"
                  )}
                >
                  {g.name}
                  {c ? ` (${cartTotal(c)})` : ""}
                </button>
              );
            })}
          </div>

          {cart && canManage ? (
            <button
              type="button"
              onClick={() => {
                clearCart(week, metal, focusGroupId);
                setCart(null);
                refresh();
              }}
              className="mb-2 text-[11px] text-white/35 hover:text-rose-200"
            >
              Vider ce panier
            </button>
          ) : null}

          {!cart || cart.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">
              Panier vide pour ce groupe
            </p>
          ) : (
            <div className="space-y-2">
              {cart.lines.map((line) => (
                <div
                  key={line.offerId}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04]">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.imageUrl}
                        alt=""
                        className="max-h-8 object-contain"
                      />
                    ) : (
                      <span>{categoryFallbackEmoji(line.category)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/85">{line.name}</p>
                    <p className="text-[11px] text-white/35">
                      {line.unitPrice} × {line.qty} ={" "}
                      {line.unitPrice * line.qty}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changeQty(line.offerId, line.qty - 1)}
                        className="rounded-md border border-white/10 p-1 text-white/50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={line.qty}
                        onChange={(e) =>
                          changeQty(
                            line.offerId,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-12 rounded-md border border-white/10 bg-black/40 px-1 py-0.5 text-center text-xs tabular-nums outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => changeQty(line.offerId, line.qty + 1)}
                        className="rounded-md border border-white/10 p-1 text-white/50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-white/90">
                  Total <OrIcon color={metal} className="h-4 w-4" /> {total}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={confirmSale}
                    className={cn(
                      "rounded-xl px-4 py-2 text-xs font-semibold",
                      metal === "rouge"
                        ? "bg-rose-500 text-white hover:bg-rose-400"
                        : "bg-sky-500 text-black hover:bg-sky-400"
                    )}
                  >
                    Valider la vente
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-medium text-white/90">
            Achats enregistrés
          </h3>
          {purchases.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">
              Aucune vente cette semaine
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white/85">{p.groupName}</p>
                    <p className="flex items-center gap-1 text-xs tabular-nums text-white/60">
                      <OrIcon color={p.metal} className="h-3.5 w-3.5" />
                      {p.total}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-white/35">
                    {p.lines.map((l) => `${l.name}×${l.qty}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </StaffPageShell>
  );
}
