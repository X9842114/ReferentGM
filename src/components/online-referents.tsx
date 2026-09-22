"use client";

import { useAccount } from "@/components/account-context";
import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { getGradeLabel } from "@/lib/grades";
import { canAccessReferentHq, isListedReferent } from "@/lib/permissions";
import {
  beginPlanningMateDrag,
  endPlanningMateDrag,
} from "@/lib/planning-drag";
import {
  presenceAgo,
  type ReferentPresencePeer,
} from "@/lib/referent-presence";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const PresenceContext = createContext<ReferentPresencePeer[]>([]);

export function ReferentPresenceProvider({ children }: { children: ReactNode }) {
  const { account, actualGrade } = useAccount();
  const dash = useDashboardUser();
  const pathname = usePathname();
  const allowed = canAccessReferentHq(actualGrade);
  const [peers, setPeers] = useState<ReferentPresencePeer[]>([]);

  const self = useMemo<ReferentPresencePeer>(
    () => ({
      userId: account.userId,
      name: dash.name?.trim() || account.displayName,
      avatarUrl: dash.image || account.discordAvatarUrl || null,
      grade: actualGrade,
      path: pathname || "/dashboard",
      at: Date.now(),
    }),
    [
      account.displayName,
      account.discordAvatarUrl,
      account.userId,
      actualGrade,
      dash.image,
      dash.name,
      pathname,
    ]
  );

  const applyPeers = useCallback(
    (list: ReferentPresencePeer[] | undefined) => {
      if (Array.isArray(list) && list.length) {
        setPeers(list);
        return;
      }
      setPeers([self]);
    },
    [self]
  );

  const ping = useCallback(async () => {
    if (!allowed || document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: self.name,
          avatarUrl: self.avatarUrl,
          path: self.path,
        }),
      });
      const data = (await res.json()) as { peers?: ReferentPresencePeer[] };
      applyPeers(data.peers);
    } catch {
      applyPeers(undefined);
    }
  }, [allowed, applyPeers, self]);

  const refresh = useCallback(async () => {
    if (!allowed) return;
    try {
      const res = await fetch("/api/presence", { cache: "no-store" });
      const data = (await res.json()) as { peers?: ReferentPresencePeer[] };
      applyPeers(data.peers);
    } catch {
      /* ignore */
    }
  }, [allowed, applyPeers]);

  useEffect(() => {
    if (!allowed) {
      setPeers([]);
      return;
    }
    void ping();
    const beat = window.setInterval(() => void ping(), 22_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [allowed, ping]);

  return (
    <PresenceContext.Provider value={peers}>{children}</PresenceContext.Provider>
  );
}

export function useOnlineReferents() {
  return useContext(PresenceContext);
}

export function ReferentsRosterPanel({
  accounts,
  assignable = false,
}: {
  accounts: Array<{
    userId: string;
    displayName: string;
    discordAvatarUrl: string;
    grade: string;
  }>;
  assignable?: boolean;
}) {
  const { account } = useAccount();
  const peers = useOnlineReferents();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!assignable) {
      const tick = window.setInterval(() => setNow(Date.now()), 8000);
      return () => window.clearInterval(tick);
    }
  }, [assignable]);

  const onlineMap = useMemo(
    () => new Map(peers.map((peer) => [peer.userId, peer])),
    [peers]
  );

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const list = accounts
      .filter((row) => isListedReferent(row.grade))
      .map((row) => {
      seen.add(row.userId);
      const live = onlineMap.get(row.userId);
      return {
        userId: row.userId,
        name: live?.name || row.displayName,
        avatarUrl: live?.avatarUrl || row.discordAvatarUrl || null,
        grade: live?.grade || row.grade,
        path: live?.path,
        at: live?.at ?? 0,
        online: Boolean(live),
      };
    });
    for (const peer of peers) {
      if (seen.has(peer.userId)) continue;
      if (!isListedReferent(peer.grade)) continue;
      list.push({
        userId: peer.userId,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        grade: peer.grade,
        path: peer.path,
        at: peer.at,
        online: true,
      });
    }
    return list
      .filter((row) => isListedReferent(row.grade))
      .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.userId === account.userId) return -1;
      if (b.userId === account.userId) return 1;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [account.userId, accounts, onlineMap, peers]);

  const onlineCount = rows.filter((row) => row.online).length;

  return (
    <aside className="rg-card flex max-h-[min(78dvh,720px)] flex-col overflow-hidden p-0 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Référents</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {onlineCount} en ligne · {Math.max(0, rows.length - onlineCount)} hors
            ligne
          </p>
          {assignable ? (
            <p className="mt-1.5 text-[11px] leading-snug text-violet-200/85">
              Attrape un profil, puis dépose-le sur une tâche du planning.
            </p>
          ) : null}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-white/40">Aucun référent.</li>
        ) : (
          rows.map((row) => {
            const mine = row.userId === account.userId;
            const href = mine
              ? "/dashboard/profil"
              : `/dashboard/referents/${encodeURIComponent(row.userId)}`;
            return (
              <li key={row.userId}>
                {assignable ? (
                  <div
                    draggable
                    title={`Glisser ${row.name} sur une tâche`}
                    onDragStart={(e) => {
                      beginPlanningMateDrag(e, {
                        userId: row.userId,
                        userName: row.name,
                      });
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => endPlanningMateDrag()}
                    className={cn(
                      "flex cursor-grab items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] active:cursor-grabbing",
                      !row.online && "opacity-70"
                    )}
                  >
                    <DiscordDecoratedAvatar
                      name={row.name}
                      url={row.avatarUrl}
                      userId={row.userId}
                      size={36}
                      status={row.online ? "online" : "offline"}
                      ringClassName="ring-2 ring-[#111113]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-white">{row.name}</span>
                        {mine ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] text-white/50">
                            toi
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/38">
                        {getGradeLabel(row.grade)}
                        {row.online ? "" : " · déconnecté"}
                      </span>
                    </span>
                  </div>
                ) : (
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04]",
                      !row.online && "opacity-55"
                    )}
                  >
                    <DiscordDecoratedAvatar
                      name={row.name}
                      url={row.avatarUrl}
                      userId={row.userId}
                      size={36}
                      status={row.online ? "online" : "offline"}
                      ringClassName="ring-2 ring-[#111113]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-white">{row.name}</span>
                        {mine ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] text-white/50">
                            toi
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/38">
                        {getGradeLabel(row.grade)}
                        {row.online ? "" : " · déconnecté"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px]",
                        row.online ? "text-emerald-300/80" : "text-white/28"
                      )}
                    >
                      {row.online ? presenceAgo(row.at, now) : "offline"}
                    </span>
                  </Link>
                )}
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
