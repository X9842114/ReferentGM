"use client";

import { useAccount } from "@/components/account-context";
import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { NavArrangePanel } from "@/components/layout/nav-arrange-panel";
import { NotificationsBell } from "@/components/notifications-bell";
import { countPendingAccounts } from "@/lib/accounts";
import { displayDiscordId, isCveBypassUser } from "@/lib/cve-access";
import { pickDiscordAvatar } from "@/lib/discord-avatar";
import { canVerifyAccounts } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { GradePreviewMenu } from "@/components/grade-preview-menu";
import { getGradeLabel } from "@/lib/grades";
import { applyNavLayout, listNavCatalog } from "@/lib/nav-catalog";
import {
  emptyNavLayout,
  getNavLayout,
  saveNavLayout,
  type NavLayout,
} from "@/lib/nav-layout";
import {
  isDiscordSnowflake,
  useDiscordUser,
} from "@/hooks/use-discord-user";
import { ChevronDown, LogOut, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SideNavbarProps = {
  userName?: string | null;
  userImage?: string | null;
  signOutAction: () => Promise<void>;
};

export function SideNavbar({
  userName,
  userImage,
  signOutAction,
}: SideNavbarProps) {
  const pathname = usePathname();
  const { account, grade } = useAccount();
  const dashUser = useDashboardUser();
  const discordId = isDiscordSnowflake(dashUser.discordId)
    ? dashUser.discordId
    : isDiscordSnowflake(account.userId)
      ? account.userId
      : isCveBypassUser(account.userId) || isCveBypassUser(dashUser.id)
        ? displayDiscordId(account.userId) || displayDiscordId(dashUser.id) || null
        : null;
  const lookup = useDiscordUser(discordId);
  const avatarSrc = pickDiscordAvatar(
    lookup?.avatarUrl,
    dashUser.image,
    account.discordAvatarUrl,
    userImage,
    discordId ? `/api/discord/avatar/${discordId}` : null
  );
  const decorationUrl =
    lookup?.decorationUrl || dashUser.discordDecorationUrl || null;
  const displayName =
    lookup?.username && !isDiscordSnowflake(lookup.username)
      ? lookup.username
      : userName?.trim() || account.displayName || "Profil";
  const [pendingCount, setPendingCount] = useState(0);
  const canSeePending = canVerifyAccounts(grade);
  const profileActive = pathname.startsWith("/dashboard/profil");
  const catalog = useMemo(() => listNavCatalog(grade), [grade]);
  const [layout, setLayout] = useState<NavLayout>(emptyNavLayout);
  const [arranging, setArranging] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLayout(getNavLayout(account.userId));
  }, [account.userId]);

  const persist = useCallback(
    (next: NavLayout) => {
      setLayout(next);
      saveNavLayout(account.userId, next);
    },
    [account.userId]
  );

  const groups = useMemo(
    () => applyNavLayout(catalog, layout),
    [catalog, layout]
  );

  useEffect(() => {
    if (!canSeePending) return;
    const refresh = () => {
      void countPendingAccounts().then(setPendingCount);
    };
    refresh();
    window.addEventListener("refgm:accounts-updated", refresh);
    return () => window.removeEventListener("refgm:accounts-updated", refresh);
  }, [canSeePending]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="fixed top-3 left-3 z-50 flex h-[calc(100dvh-1.5rem)] w-14 flex-col overflow-visible rounded-[1.75rem] border border-[var(--rg-glass-border)] bg-background/80 py-3 shadow-none backdrop-blur-2xl lg:w-[16.5rem] lg:px-3">
      <Link
        href="/dashboard"
        className="mx-auto mb-3 flex items-center justify-center lg:mx-0 lg:mb-5 lg:w-full lg:justify-start lg:gap-2.5 lg:px-1.5"
        title="RefGM · Référent GameMaster"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
          <Image
            src="/brand/fa-logo.png"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
            priority
          />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block text-[15px] font-medium tracking-tight text-white/90">
            RefGM
          </span>
          <span className="block truncate text-[11px] text-white/40">
            Référent GameMaster
          </span>
        </span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto overscroll-contain [scrollbar-width:none] lg:items-stretch lg:gap-4 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setArranging(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 hover:bg-white/[0.04] hover:text-white/80 lg:h-8 lg:w-full lg:justify-center lg:gap-1.5 lg:text-[11px]"
          title="Agencer la barre"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Agencer</span>
        </button>

        {groups.map((group) => {
          const collapsed = Boolean(layout.collapsed[group.id]);
          return (
            <div
              key={group.id}
              className="flex w-full flex-col items-center gap-0.5 lg:items-stretch"
            >
              <button
                type="button"
                onClick={() =>
                  persist({
                    ...layout,
                    collapsed: {
                      ...layout.collapsed,
                      [group.id]: !layout.collapsed[group.id],
                    },
                  })
                }
                className="hidden w-full items-center gap-1 rounded-lg px-2 py-1 text-left lg:flex"
                title={collapsed ? "Déplier" : "Replier"}
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 text-white/30 transition-transform",
                    collapsed && "rotate-[-90deg]"
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-[0.2em] text-white/28 uppercase">
                  {group.label}
                </span>
              </button>
              <div
                className="my-0.5 h-px w-6 bg-white/10 lg:hidden"
                aria-hidden
              />
              {collapsed
                ? null
                : group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const badge =
                      item.badge === "pending" && pendingCount > 0
                        ? pendingCount
                        : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
        className={cn(
                          "group relative flex h-10 w-10 items-center justify-center rounded-2xl text-[13px] transition-colors duration-200 lg:h-9 lg:w-full lg:justify-start lg:gap-2.5 lg:px-3",
                          active
                            ? "bg-violet-400/12 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.28)]"
                            : "text-white/45 hover:bg-white/[0.05] hover:text-white/85"
                        )}
                      >
                        {active ? (
                          <span className="absolute top-1/2 left-0 hidden h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-400 lg:block" />
                        ) : null}
                        <Icon
                          strokeWidth={1.75}
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-violet-200" : "opacity-90"
                          )}
                        />
                        <span className="hidden min-w-0 truncate lg:inline">
                          {item.label}
                        </span>
                        {badge > 0 ? (
                          <span
                            className={cn(
                              "absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold lg:static lg:ml-auto",
                              active
                                ? "bg-white text-[#0a0a0b]"
                                : "bg-violet-500 text-white"
                            )}
                          >
                            {badge > 9 ? "9+" : badge}
                          </span>
                        ) : null}
                        <span className="pointer-events-none absolute left-full z-20 ml-3 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[11px] whitespace-nowrap text-white/80 opacity-0 group-hover:opacity-100 lg:hidden">
                          {group.label} · {item.label}
                        </span>
                      </Link>
                    );
                  })}
            </div>
          );
        })}
      </nav>

      <div className="mt-2 shrink-0 overflow-visible border-t border-white/[0.06] pt-2">
        <GradePreviewMenu />

        <div className="flex flex-col items-center gap-1.5 overflow-visible lg:flex-row lg:items-center lg:gap-0.5 lg:rounded-2xl lg:bg-white/[0.05] lg:p-1 lg:pr-1">
          <Link
            href="/dashboard/profil"
            className={cn(
              "flex w-14 items-center justify-center overflow-visible rounded-xl p-0 transition-colors lg:w-auto lg:min-w-0 lg:flex-1 lg:justify-start lg:gap-1 lg:py-0 lg:pr-1 lg:pl-0",
              profileActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            )}
            title="Mon profil"
          >
            <DiscordDecoratedAvatar
              name={displayName}
              url={avatarSrc}
              decorationUrl={decorationUrl}
              userId={discordId}
              size={36}
              ringClassName="ring-2 ring-black/40"
            />
            <span className="hidden min-w-0 flex-1 lg:block">
              <span className="block truncate text-[13px] font-medium tracking-tight text-white">
                {displayName}
              </span>
              <span className="block truncate text-[11px] text-white/40">
                {getGradeLabel(grade)}
              </span>
            </span>
          </Link>
          <NotificationsBell />
          <form action={signOutAction}>
            <button
              type="submit"
              title="Déconnexion"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/85"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {mounted && arranging
        ? createPortal(
            <NavArrangePanel
              userId={account.userId}
              grade={grade}
              layout={layout}
              onChange={setLayout}
              onClose={() => setArranging(false)}
            />,
            document.body
          )
        : null}
    </aside>
  );
}
