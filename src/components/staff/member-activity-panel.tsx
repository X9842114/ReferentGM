"use client";

import { DiscordAvatar } from "@/components/actor-trace";
import { listGiveRequests } from "@/lib/give-requests";
import { listMissions } from "@/lib/mission-storage";
import { listWarnings } from "@/lib/supervision";
import type { RefgmAccount } from "@/lib/accounts";
import { Activity, ArrowDown, ArrowUp, ChevronRight, Clock3, FileText, GitPullRequest, ShieldAlert, Vote } from "lucide-react";
import { useMemo, useState } from "react";

type AuditEntry = { id:string;actor_id:string;actor_name:string;action:string;entity_type:string;entity_id:string|null;metadata:Record<string,unknown>;created_at:string };
type Metric = { label:string; current:number; previous:number; icon:React.ReactNode; suffix?:string };

export function MemberActivityPanel({ accounts, logs }: { accounts: RefgmAccount[]; logs: AuditEntry[] }) {
  const [selectedId,setSelectedId]=useState(accounts[0]?.userId||"");
  const [days,setDays]=useState(30);
  const missions=useMemo(()=>listMissions(),[logs]);
  const gives=useMemo(()=>listGiveRequests(),[logs]);
  const warnings=useMemo(()=>listWarnings(),[logs]);
  const selected=accounts.find((account)=>account.userId===selectedId)||accounts[0];
  if(!selected)return <p className="rounded-2xl border border-white/10 p-8 text-center text-sm text-white/35">Aucun membre à analyser.</p>;
  const now=Date.now(), start=now-days*86400000, previousStart=start-days*86400000;
  const within=(date:string|null|undefined,from:number,to:number)=>{const time=Date.parse(date||"");return Number.isFinite(time)&&time>=from&&time<to;};
  const countFor=(from:number,to:number)=>{
    const created=missions.filter((mission)=>mission.authorId===selected.userId&&within(mission.createdAt,from,to)).length;
    const votes=missions.flatMap((mission)=>mission.votes||[]).filter((vote)=>vote.userId===selected.userId&&within(vote.at,from,to));
    const treated=new Set(missions.filter((mission)=>(mission.votes||[]).some((vote)=>vote.userId===selected.userId&&within(vote.at,from,to))).map((mission)=>mission.id)).size;
    const giveRows=gives.filter((row)=>(row.requesterId===selected.userId&&within(row.createdAt,from,to))||(row.reviewerId===selected.userId&&within(row.reviewedAt,from,to))).length;
    const warned=warnings.filter((row)=>row.targetUserId===selected.userId&&within(row.createdAt,from,to)).length;
    const integrations=logs.filter((entry)=>entry.actor_id===selected.userId&&entry.action==="recruitment.application_updated"&&entry.metadata?.to==="ACCEPTED"&&within(entry.created_at,from,to)).length;
    const responseTimes=missions.flatMap((mission)=>(mission.votes||[]).filter((vote)=>vote.userId===selected.userId&&within(vote.at,from,to)).map((vote)=>Math.max(0,Date.parse(vote.at)-Date.parse(mission.createdAt))));
    const average=responseTimes.length?Math.round(responseTimes.reduce((sum,value)=>sum+value,0)/responseTimes.length/60000):0;
    return {created,votes:votes.length,treated,giveRows,warned,integrations,average};
  };
  const current=countFor(start,now),previous=countFor(previousStart,start);
  const metrics:Metric[]=[{label:"Missions créées",current:current.created,previous:previous.created,icon:<FileText/>},{label:"Missions traitées",current:current.treated,previous:previous.treated,icon:<GitPullRequest/>},{label:"Votes effectués",current:current.votes,previous:previous.votes,icon:<Vote/>},{label:"Réponse moyenne",current:current.average,previous:previous.average,icon:<Clock3/>,suffix:" min"},{label:"Demandes de give",current:current.giveRows,previous:previous.giveRows,icon:<Activity/>},{label:"Avertissements reçus",current:current.warned,previous:previous.warned,icon:<ShieldAlert/>},{label:"Intégrations réalisées",current:current.integrations,previous:previous.integrations,icon:<ChevronRight/>}];
  const memberLogs=logs.filter((entry)=>entry.actor_id===selected.userId||entry.entity_id===selected.userId);
  const gradeHistory=memberLogs.filter((entry)=>entry.action==="account.grade_changed");
  const lastActivity=[...memberLogs.map((entry)=>entry.created_at),...missions.filter((mission)=>mission.authorId===selected.userId).map((mission)=>mission.updatedAt),...gives.filter((row)=>row.requesterId===selected.userId||row.reviewerId===selected.userId).map((row)=>row.reviewedAt||row.createdAt)].sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  return <div className="grid gap-5 lg:grid-cols-[280px_1fr]"><aside className="space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3"><p className="px-2 pb-2 text-xs uppercase tracking-wider text-white/30">Membres</p>{accounts.map((account)=><button key={account.userId} onClick={()=>setSelectedId(account.userId)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${selected.userId===account.userId?"bg-violet-400/10 ring-1 ring-violet-400/20":"hover:bg-white/[0.04]"}`}><DiscordAvatar name={account.displayName} url={account.discordAvatarUrl} size={38}/><div className="min-w-0"><p className="truncate text-sm text-white/80">{account.displayName}</p><p className="truncate text-[10px] text-white/30">{account.grade}</p></div></button>)}</aside><div className="space-y-5"><header className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><DiscordAvatar name={selected.displayName} url={selected.discordAvatarUrl} size={58}/><div className="mr-auto"><h2 className="text-xl font-medium">{selected.displayName}</h2><p className="mt-1 text-xs text-white/35">Dernière activité : {lastActivity?new Date(lastActivity).toLocaleString("fr-FR"):"aucune donnée"}</p></div><select value={days} onChange={(event)=>setDays(Number(event.target.value))} className="rounded-xl border border-white/10 bg-[#11141a] px-3 py-2 text-xs"><option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option><option value={90}>90 derniers jours</option></select></header><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric)=><MetricCard key={metric.label} metric={metric}/>)}</div><section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"><h3 className="text-sm font-medium">Historique des grades</h3>{gradeHistory.length?<div className="mt-4 space-y-2">{gradeHistory.map((entry)=><div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-3 text-xs"><span className="text-white/45">{String(entry.metadata?.from||"?")}</span><ChevronRight className="h-4 w-4 text-violet-300/50"/><span className="text-white/80">{String(entry.metadata?.to||"?")}</span><time className="ml-auto text-white/25">{new Date(entry.created_at).toLocaleString("fr-FR")}</time></div>)}</div>:<p className="mt-4 text-xs text-white/30">Aucun changement de grade enregistré.</p>}</section></div></div>;
}

function MetricCard({metric}:{metric:Metric}){const delta=metric.current-metric.previous;return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-white/35 [&_svg]:h-4 [&_svg]:w-4">{metric.icon}<span className="text-xs">{metric.label}</span></div><div className="mt-3 flex items-end justify-between"><p className="text-2xl font-medium">{metric.current}{metric.suffix}</p><span className={`flex items-center text-[11px] ${delta>0?"text-emerald-300/70":delta<0?"text-rose-300/70":"text-white/25"}`}>{delta>0?<ArrowUp className="h-3 w-3"/>:delta<0?<ArrowDown className="h-3 w-3"/>:null}{delta===0?"Stable":`${Math.abs(delta)} vs avant`}</span></div></div>}
