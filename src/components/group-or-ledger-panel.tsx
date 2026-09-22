"use client";

import { listMissions } from "@/lib/mission-storage";
import { listAllPurchases } from "@/lib/or-market";
import { RP_GROUPS } from "@/lib/rp-groups";
import { Download, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Period = "WEEK" | "MONTH";

function currentPeriodValue(period: Period) {
  const now = new Date();
  if (period === "MONTH") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function periodRange(period: Period, value: string) {
  if (period === "MONTH") {
    const [year, month] = value.split("-").map(Number);
    return [new Date(year, month - 1, 1).getTime(), new Date(year, month, 1).getTime()] as const;
  }
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  const year = Number(match?.[1]); const week = Number(match?.[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth); monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (week - 1) * 7);
  return [monday.getTime(), monday.getTime() + 7 * 86400000] as const;
}

export function GroupOrLedgerPanel() {
  const [period, setPeriod] = useState<Period>("WEEK");
  const [periodValue, setPeriodValue] = useState(() => currentPeriodValue("WEEK"));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("refgm:missions-updated", refresh);
    window.addEventListener("refgm:staff-updated", refresh);
    return () => { window.removeEventListener("refgm:missions-updated", refresh); window.removeEventListener("refgm:staff-updated", refresh); };
  }, []);
  const rows = useMemo(() => {
    const [start, end] = periodRange(period, periodValue);
    const missions = listMissions();
    const purchases = listAllPurchases();
    return RP_GROUPS.map((group) => {
      const periodMissions = missions.filter((mission) => { const at = Date.parse(mission.reviewedAt || mission.updatedAt); return mission.status === "approved" && at >= start && at < end && mission.groupIds.includes(group.id); });
      const earned = (scope: typeof missions, metal: "rouge" | "bleu") => scope.reduce((sum, mission) => sum + (mission.orRewards || []).filter((reward) => reward.groupId === group.id && reward.color === metal).reduce((value, reward) => value + reward.amount, 0), 0);
      const periodPurchases = purchases.filter((purchase) => { const at = Date.parse(purchase.createdAt); return purchase.groupId === group.id && at >= start && at < end; });
      const allMissions = missions.filter((mission) => mission.status === "approved" && mission.groupIds.includes(group.id));
      const totalSpent = (metal: "rouge" | "bleu") => purchases.filter((purchase) => purchase.groupId === group.id && purchase.metal === metal).reduce((sum, purchase) => sum + purchase.total, 0);
      return { id: group.id, name: group.name, kind: group.kind, missions: periodMissions.length, earnedRouge: earned(periodMissions, "rouge"), earnedBleu: earned(periodMissions, "bleu"), spentRouge: periodPurchases.filter((purchase) => purchase.metal === "rouge").reduce((sum, purchase) => sum + purchase.total, 0), spentBleu: periodPurchases.filter((purchase) => purchase.metal === "bleu").reduce((sum, purchase) => sum + purchase.total, 0), estimatedRouge: earned(allMissions, "rouge") - totalSpent("rouge"), estimatedBleu: earned(allMissions, "bleu") - totalSpent("bleu") };
    }).filter((row) => row.missions || row.earnedRouge || row.earnedBleu || row.spentRouge || row.spentBleu).sort((a, b) => b.missions - a.missions || a.name.localeCompare(b.name, "fr"));
  }, [period, periodValue, revision]);

  function exportCsv() {
    const purchases = listAllPurchases();
    const [start, end] = periodRange(period, periodValue);
    const periodPurchases = purchases.filter((purchase) => {
      const at = Date.parse(purchase.createdAt);
      return at >= start && at < end;
    });
    const header = ["Groupe", "Type", "Missions", "Entrees rouge", "Depenses rouge", "Solde rouge estime", "Entrees bleu", "Depenses bleu", "Solde bleu estime"];
    const recap = rows.map((row) => [row.name, row.kind, row.missions, row.earnedRouge, row.spentRouge, row.estimatedRouge, row.earnedBleu, row.spentBleu, row.estimatedBleu]);
    const buyHeader = ["Achats", "Date", "Groupe", "Metal", "Total", "Vendeur", "Lignes"];
    const buyRows = periodPurchases.map((p) => [
      p.id,
      p.createdAt,
      p.groupName,
      p.metal,
      p.total,
      p.soldBy,
      p.lines.map((l) => `${l.qty}x ${l.name} (${l.unitPrice})`).join(" | "),
    ]);
    const blob = new Blob(
      [
        "\ufeff",
        [header.join(";"), ...recap.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))].join("\n"),
        "\n\n",
        [buyHeader.join(";"), ...buyRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))].join("\n"),
      ],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recap-groupes-${periodValue}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-[.18em] text-amber-200/55">Registre des récompenses</p><h2 className="mt-2 text-xl font-medium">Récapitulatif des groupes</h2><p className="mt-1 flex max-w-2xl items-start gap-2 text-sm leading-6 text-white/40"><Info className="mt-1 h-3.5 w-3.5 shrink-0"/>Le solde est théorique : entrées validées par les missions moins les achats enregistrés sur le marché. Il ne remplace pas l’inventaire réel du serveur.</p></div><div className="flex flex-wrap gap-2"><div className="rounded-xl border border-white/10 bg-black/20 p-1">{([['WEEK','Semaine'],['MONTH','Mois']] as const).map(([id,label]) => <button key={id} onClick={() => { setPeriod(id); setPeriodValue(currentPeriodValue(id)); }} className={`rounded-lg px-3 py-1.5 text-xs ${period === id ? "bg-white/10 text-white" : "text-white/35"}`}>{label}</button>)}</div><input aria-label={period === "WEEK" ? "Semaine du rapport" : "Mois du rapport"} type={period === "WEEK" ? "week" : "month"} value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} className="rounded-xl border border-white/10 bg-[#141419] px-3 py-2 text-xs text-white/65"/><button onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/5 disabled:opacity-30"><Download className="h-3.5 w-3.5"/>Exporter CSV</button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-white/25"><tr><th className="pb-3">Groupe</th><th className="pb-3">Missions</th><th className="pb-3">Entrées</th><th className="pb-3">Dépenses</th><th className="pb-3">Solde estimé</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{rows.map((row) => <tr key={row.id}><td className="py-3"><b className="text-white/70">{row.name}</b><span className="ml-2 text-white/25">{row.kind}</span></td><td className="py-3 text-white/50">{row.missions}</td><td className="py-3"><span className="inline-flex items-center gap-1 text-rose-200/70"><TrendingUp className="h-3 w-3"/>{row.earnedRouge} R</span><span className="ml-3 text-violet-200/70">{row.earnedBleu} B</span></td><td className="py-3"><span className="inline-flex items-center gap-1 text-rose-200/55"><TrendingDown className="h-3 w-3"/>{row.spentRouge} R</span><span className="ml-3 text-violet-200/55">{row.spentBleu} B</span></td><td className="py-3"><b className="text-rose-200/80">{row.estimatedRouge} R</b><b className="ml-3 text-violet-200/80">{row.estimatedBleu} B</b></td></tr>)}{!rows.length ? <tr><td colSpan={5} className="py-10 text-center text-white/30">Aucun mouvement enregistré sur cette période.</td></tr> : null}</tbody></table></div></section>;
}
