"use client";

import { useAccount } from "@/components/account-context";
import { DiscordAvatar } from "@/components/actor-trace";
import { listAllAccounts, type RefgmAccount } from "@/lib/accounts";
import { canAccessStaffTools } from "@/lib/permissions";
import { listChatMessages, sendChatMessage, type ChatChannel, type ChatMessage } from "@/lib/team-chat";
import { MessageCircleMore, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export function TeamChatBubble() {
  const { account, grade } = useAccount();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>("GENERAL");
  const [seenCount, setSeenCount] = useState(0);
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const allowed = canAccessStaffTools(grade);

  useEffect(() => {
    if (!allowed) return;
    const refresh = () => setMessages(listChatMessages());
    refresh();
    void listAllAccounts().then((rows) => setAccounts(rows.filter((row) => row.status === "APPROVED")));
    window.addEventListener("refgm:chat-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("refgm:chat-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [allowed]);

  const visible = useMemo(() => messages.filter((message) => message.channel === channel).slice(-60), [messages, channel]);
  const unread = Math.max(0, messages.length - seenCount);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [open, visible.length]);

  if (!allowed) return null;

  function submit() {
    const text = body.trim();
    if (!text) return;
    const mentionIds = accounts.filter((member) => text.toLowerCase().includes(`@${member.displayName.toLowerCase()}`)).map((member) => member.userId);
    sendChatMessage({ channel, authorId: account.userId, authorName: account.displayName, authorAvatar: account.discordAvatarUrl, body: text, mentionIds });
    setBody("");
  }

  return (
    <div className="fixed right-4 bottom-24 z-[70] sm:right-6 lg:bottom-6">
      <AnimatePresence>
        {open ? (
          <motion.section initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .97 }} className="mb-3 flex h-[min(620px,72dvh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#101014]/95 text-white shadow-[0_24px_90px_rgba(0,0,0,.65)] backdrop-blur-2xl">
            <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
              <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-400/10 p-2 text-violet-200"><MessageCircleMore className="h-4 w-4" /></span><div><p className="text-sm font-medium">Chat des Référents</p><p className="text-[10px] text-white/35">Équipe Référent GM</p></div></div>
              <button onClick={() => setOpen(false)} aria-label="Fermer le chat" className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
            </header>
            <nav className="grid grid-cols-3 gap-1 border-b border-white/[0.07] p-2">{([['GENERAL','Général'],['MISSIONS','Missions'],['AIDE','Aide']] as const).map(([id,label]) => <button key={id} onClick={() => setChannel(id)} className={`rounded-lg px-2 py-2 text-[11px] transition ${channel === id ? "bg-violet-400/10 text-violet-100" : "text-white/35 hover:bg-white/5"}`}>{label}</button>)}</nav>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {visible.length ? visible.map((message) => <article key={message.id} className="flex gap-2.5"><DiscordAvatar name={message.authorName} url={message.authorAvatar} size={30} className="shrink-0 rounded-lg"/><div className="min-w-0"><div className="flex items-baseline gap-2"><b className="truncate text-xs text-white/80">{message.authorName}</b><span className="text-[9px] text-white/25">{new Date(message.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-white/55">{message.body}</p></div></article>) : <div className="flex h-full items-center justify-center text-xs text-white/30">Aucun message pour le moment.</div>}
              <div ref={endRef}/>
            </div>
            <footer className="border-t border-white/[0.07] p-3"><div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/25 p-2 focus-within:border-violet-400/25"><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={2} placeholder="Écrire… Utilise @Nom pour mentionner" className="max-h-28 flex-1 resize-none bg-transparent px-1 text-xs leading-5 outline-none placeholder:text-white/25"/><button onClick={submit} disabled={!body.trim()} aria-label="Envoyer" className="rounded-xl bg-violet-300 p-2.5 text-[#071014] disabled:opacity-35"><Send className="h-4 w-4"/></button></div></footer>
          </motion.section>
        ) : null}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: .95 }} onClick={() => setOpen((value) => { const next = !value; if (next) setSeenCount(messages.length); return next; })} aria-label="Ouvrir le chat d’équipe" className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-200/20 bg-violet-300 text-[#071014] shadow-[0_12px_45px_rgba(56,189,248,.35)]"><MessageCircleMore className="h-6 w-6"/>{!open && unread ? <span className="absolute -top-1 -right-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{Math.min(unread, 99)}</span> : null}</motion.button>
    </div>
  );
}
