"use client";

import { useAccount } from "@/components/account-context";
import {
  countUnreadNotifications,
  listNotificationsFor,
  markAllNotificationsRead,
  markNotificationRead,
  type SiteNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Gift,
  MessageSquare,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 45_000) return "À l’instant";
  if (diff < 3_600_000) return `Il y a ${Math.max(1, Math.floor(diff / 60_000))} min`;
  if (diff < 86_400_000) {
    return `Aujourd’hui · ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  if (diff < 172_800_000) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function typeMeta(type: string) {
  const t = type.toLowerCase();
  if (t.includes("mission") || t.includes("groupe")) {
    return { icon: ClipboardList, tone: "bg-violet-500/18 text-violet-200" };
  }
  if (t.includes("planning")) {
    return { icon: CalendarDays, tone: "bg-sky-500/18 text-sky-200" };
  }
  if (t.includes("give")) {
    return { icon: Gift, tone: "bg-amber-500/18 text-amber-200" };
  }
  if (t.includes("chat") || t.includes("mention")) {
    return { icon: MessageSquare, tone: "bg-fuchsia-500/18 text-fuchsia-200" };
  }
  if (t.includes("account") || t.includes("grade")) {
    return { icon: UserCheck, tone: "bg-emerald-500/18 text-emerald-200" };
  }
  if (t.includes("supervision") || t.includes("warning")) {
    return { icon: ShieldAlert, tone: "bg-rose-500/18 text-rose-200" };
  }
  return { icon: Bell, tone: "bg-white/[0.08] text-white/70" };
}

export function NotificationsBell() {
  const { account } = useAccount();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SiteNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState({ bottom: 16, left: 72 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function refresh() {
    setRows(listNotificationsFor(account.userId).slice(0, 40));
    setUnread(countUnreadNotifications(account.userId));
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:notifications-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("refgm:notifications-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.userId]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    let left = r.right + 12;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, r.left - width - 12);
    }
    setPos({
      bottom: Math.max(12, window.innerHeight - r.bottom - 8),
      left,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadRows = useMemo(() => rows.filter((n) => !n.readAt), [rows]);
  const readRows = useMemo(() => rows.filter((n) => n.readAt), [rows]);

  function renderRow(n: SiteNotification) {
    const meta = typeMeta(n.type);
    const Icon = meta.icon;
    const inner = (
      <span className="flex gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            meta.tone
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug font-medium text-white">
            {n.title}
          </span>
          {n.body ? (
            <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-white/42">
              {n.body}
            </span>
          ) : null}
          <span className="mt-1.5 block text-[11px] text-white/30">
            {timeLabel(n.createdAt)}
          </span>
        </span>
        {!n.readAt ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
        ) : null}
      </span>
    );
    const className = cn(
      "block w-full rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]",
      !n.readAt && "bg-violet-500/[0.07]"
    );
    if (n.href) {
      return (
        <li key={n.id}>
          <Link
            href={n.href}
            className={className}
            onClick={() => {
              markNotificationRead(n.id, account.userId);
              setOpen(false);
              refresh();
            }}
          >
            {inner}
          </Link>
        </li>
      );
    }
    return (
      <li key={n.id}>
        <button
          type="button"
          className={className}
          onClick={() => {
            markNotificationRead(n.id, account.userId);
            refresh();
          }}
        >
          {inner}
        </button>
      </li>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          refresh();
        }}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          open
            ? "bg-white/[0.1] text-white"
            : "text-white/40 hover:bg-white/[0.08] hover:text-white/90"
        )}
        title="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="rg-card fixed z-[120] w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden p-0 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
              style={{ bottom: pos.bottom, left: pos.left }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  <p className="mt-0.5 text-[11px] text-white/38">
                    {unread > 0
                      ? `${unread} non lue${unread > 1 ? "s" : ""}`
                      : "Tout est lu"}
                  </p>
                </div>
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      markAllNotificationsRead(account.userId);
                      refresh();
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout lu
                  </button>
                ) : null}
              </div>
              <div className="max-h-[min(26rem,calc(100dvh-6rem))] overflow-y-auto px-2 py-2">
                {rows.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-white/30">
                      <Bell className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm text-white/50">Rien pour le moment</p>
                    <p className="mt-1 text-[11px] text-white/30">
                      Les missions, gives et le planning arrivent ici.
                    </p>
                  </div>
                ) : (
                  <>
                    {unreadRows.length ? (
                      <div className="mb-2">
                        <p className="px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/30 uppercase">
                          Nouveau
                        </p>
                        <ul className="space-y-0.5">{unreadRows.map(renderRow)}</ul>
                      </div>
                    ) : null}
                    {readRows.length ? (
                      <div>
                        {unreadRows.length ? (
                          <p className="px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/30 uppercase">
                            Déjà vu
                          </p>
                        ) : null}
                        <ul className="space-y-0.5">{readRows.map(renderRow)}</ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
