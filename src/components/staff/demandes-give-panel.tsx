"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { createGiveRequest, deleteGiveRequest, listGiveRequests, reviewGiveRequest, type GiveCommandType, type GiveRequest } from "@/lib/give-requests";
import { canProposeGiveRequests, canReviewGiveRequests } from "@/lib/permissions";
import { loadOwnProfile } from "@/lib/profile-storage";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Clock3, Copy, Send, Terminal, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<GiveRequest["status"], string> = { PENDING: "En attente", APPROVED: "Approuvée", REJECTED: "Refusée" };

export function DemandesGivePanel() {
  const { account, grade } = useAccount();
  const canRequest = canProposeGiveRequests(grade), canReview = canReviewGiveRequests(grade);
  const [rows, setRows] = useState<GiveRequest[]>([]), [filter, setFilter] = useState<"ALL" | "PENDING" | "MINE">("PENDING");
  const [commandType, setCommandType] = useState<GiveCommandType>("GiveItem"), [itemName, setItemName] = useState(""), [quantity, setQuantity] = useState(1), [characterId, setCharacterId] = useState(""), [reason, setReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({}), [copiedId, setCopiedId] = useState("");
  const profile = useMemo(() => loadOwnProfile({ userId: account.userId, name: account.displayName, image: account.discordAvatarUrl }), [account]);
  const uniqueId = profile.uniqueId;
  const commandTarget = commandType === "GiveItemOffline2" ? uniqueId : characterId.trim();
  const commandPreview = `/${commandType} ${itemName.trim() || "item"} ${Math.max(1, quantity)} ${commandTarget || (commandType === "GiveItemOffline2" ? "ID_UNIQUE" : "ID_PERSONNAGE")} ${reason.trim() || "raison"}`;
  const refresh = () => setRows(listGiveRequests());

  useEffect(() => { refresh(); const update = () => refresh(); window.addEventListener("refgm:staff-updated", update); return () => window.removeEventListener("refgm:staff-updated", update); }, []);
  const visible = useMemo(() => filter === "PENDING" ? rows.filter((row) => row.status === "PENDING") : filter === "MINE" ? rows.filter((row) => row.requesterId === account.userId) : rows, [rows, filter, account.userId]);

  function submitRequest() {
    if (!canRequest || !itemName.trim() || !reason.trim() || !commandTarget) return;
    createGiveRequest({ itemName, quantity, reason, commandType, uniqueId, characterId, requesterId: account.userId, requesterName: account.displayName });
    setItemName(""); setQuantity(1); setCharacterId(""); setReason(""); setFilter("MINE"); refresh();
  }
  function decide(id: string, status: "APPROVED" | "REJECTED") { if (!canReview) return; reviewGiveRequest({ id, status, reviewNote: reviewNotes[id] ?? "", reviewerId: account.userId, reviewerName: account.displayName }); refresh(); }
  async function copy(command: string, id: string) { await navigator.clipboard.writeText(command); setCopiedId(id); window.setTimeout(() => setCopiedId(""), 1800); }

  const field = "h-11 w-full rounded-xl border border-white/[0.09] bg-black/25 px-3 text-sm text-white outline-none transition focus:border-white/25";
  return <StaffPageShell title="Demandes de Give" description={canReview ? "Commandes reçues et prêtes à être traitées" : "Prépare une commande à faire valider"} className="max-w-6xl" backHref={canReview ? "/dashboard/administration" : "/dashboard"} backLabel={canReview ? "Administration" : "Dashboard"}>
    {canRequest ? <section className="rounded-2xl border border-white/[0.08] bg-white/[0.022] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/60"><Terminal className="h-5 w-5"/></span><div><h2 className="text-sm font-medium text-white/85">Préparer une commande</h2><p className="mt-0.5 text-xs text-white/30">L’ID unique est repris automatiquement depuis ton profil.</p></div></div><div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">{(["GiveItem","GiveItemOffline2"] as GiveCommandType[]).map((type)=><button key={type} onClick={()=>setCommandType(type)} className={cn("rounded-lg px-3 py-2 font-mono text-[11px] transition",commandType===type?"bg-white/10 text-white":"text-white/35 hover:text-white/65")}>/{type}</button>)}</div></div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_.55fr_1fr_1.5fr]">
        <label className="text-[10px] uppercase tracking-wider text-white/30">Nom de l’item<input value={itemName} onChange={(event)=>setItemName(event.target.value)} placeholder="weapon_pistol" className={field}/></label>
        <label className="text-[10px] uppercase tracking-wider text-white/30">Quantité<input type="number" min={1} value={quantity} onChange={(event)=>setQuantity(Math.max(1,Number(event.target.value)||1))} className={field}/></label>
        {commandType === "GiveItem" ? <label className="text-[10px] uppercase tracking-wider text-white/30">ID personnage<input value={characterId} onChange={(event)=>setCharacterId(event.target.value)} placeholder="Ex. 1524" className={field}/></label> : <label className="text-[10px] uppercase tracking-wider text-white/30">ID unique<input readOnly value={uniqueId} className={cn(field,"text-white/45")}/></label>}
        <label className="text-[10px] uppercase tracking-wider text-white/30">Raison<input value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Justification du GIVE" className={field}/></label>
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-white/50">{commandPreview}</code><button onClick={submitRequest} disabled={!itemName.trim()||!reason.trim()||!commandTarget} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-25"><Send className="h-3.5 w-3.5"/>Envoyer au référent GM</button></div>
    </section> : null}

    <div className="flex flex-wrap gap-2">{([['PENDING','En attente'],['MINE','Mes demandes'],['ALL','Toutes']] as const).map(([id,label])=><button key={id} onClick={()=>setFilter(id)} className={cn("rounded-xl border px-3 py-2 text-xs transition",filter===id?"border-white/18 bg-white/[0.08] text-white":"border-white/[0.07] text-white/35 hover:text-white/65")}>{label}</button>)}</div>
    {visible.length ? <div className="space-y-3">{visible.map((row)=>{const command=row.generatedCommand||`/${row.commandType||"GiveItem"} ${row.itemName} ${row.quantity} ${row.commandType==="GiveItemOffline2"?row.uniqueId||"ID_UNIQUE":row.characterId||row.targetId||"ID_PERSONNAGE"} ${row.reason}`;return <article key={row.id} className="rounded-2xl border border-white/[0.075] bg-white/[0.02] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-white/85">{row.itemName} <span className="text-white/35">×{row.quantity}</span></h3><Status status={row.status}/></div><p className="mt-1 text-[11px] text-white/30">Demandé par {row.requesterName} · {new Date(row.createdAt).toLocaleString("fr-FR")}</p></div><button onClick={()=>void copy(command,row.id)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/55 hover:text-white">{copiedId===row.id?<CheckCircle2 className="h-4 w-4 text-emerald-300"/>:<Copy className="h-4 w-4"/>}{copiedId===row.id?"Copiée":"Copier la commande"}</button></div><code className="mt-3 block overflow-x-auto whitespace-nowrap rounded-xl bg-black/25 p-3 text-xs text-white/55">{command}</code>{row.status==="PENDING"&&canReview?<div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:flex-row"><input value={reviewNotes[row.id]??""} onChange={(event)=>setReviewNotes((current)=>({...current,[row.id]:event.target.value}))} placeholder="Note facultative" className={cn(field,"flex-1")}/><button onClick={()=>decide(row.id,"APPROVED")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-300/12 px-3 text-xs text-emerald-200"><Check className="h-4 w-4"/>Approuver</button><button onClick={()=>decide(row.id,"REJECTED")} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-300/8 px-3 text-xs text-rose-200"><X className="h-4 w-4"/>Refuser</button></div>:null}{row.reviewNote?<p className="mt-3 text-xs text-white/35">{row.reviewerName} : {row.reviewNote}</p>:null}{(canReview||(row.requesterId===account.userId&&row.status==="PENDING"))?<button onClick={()=>{deleteGiveRequest(row.id);refresh();}} className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/25 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5"/>Supprimer</button>:null}</article>})}</div>:<div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center"><Clock3 className="mx-auto h-7 w-7 text-white/18"/><p className="mt-3 text-sm text-white/35">Aucune demande</p></div>}
  </StaffPageShell>;
}

function Status({status}:{status:GiveRequest["status"]}) { return <span className={cn("rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider",status==="PENDING"?"border-white/10 text-white/40":status==="APPROVED"?"border-emerald-300/18 text-emerald-200/70":"border-rose-300/18 text-rose-200/70")}>{STATUS_LABEL[status]}</span>; }
