"use client";

import { useAccount } from "@/components/account-context";
import { DiscordDecoratedAvatar } from "@/components/actor-trace";
import {
  discordDisplayName,
  isDiscordSnowflake,
  useDiscordUser,
} from "@/hooks/use-discord-user";
import { HomeMissionLog } from "@/components/home-mission-log";
import { ReferentsRosterPanel } from "@/components/online-referents";
import { ProfileCard } from "@/components/profile-card";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  countPendingAccounts,
  listAllAccounts,
  listPendingAccounts,
  type RefgmAccount,
} from "@/lib/accounts";
import { getGradeDef } from "@/lib/grade-registry";
import { canVerifyAccounts, getGradeLabel, isListedReferent, isReferent } from "@/lib/permissions";
import { defaultProfile, getProfile } from "@/lib/profile-storage";
import { displayDiscordId } from "@/lib/cve-access";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import {
  listOpenTasksForUser,
  PLANNING_PRIORITY_LABEL,
  setPlanningStatus,
  type PlanningSlot,
} from "@/lib/referent-planning";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardPaste,
  Clock,
  ListChecks,
  Map,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatTaskDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const PRIORITY_TONE: Record<PlanningSlot["priority"], string> = {
  urgent: "border-rose-400/35 bg-rose-500/18 text-rose-100",
  important: "border-amber-400/30 bg-amber-500/16 text-amber-100",
  todo: "border-violet-400/30 bg-violet-500/16 text-violet-100",
  other: "border-white/12 bg-white/[0.06] text-white/65",
};

const PRIORITY_BAR: Record<PlanningSlot["priority"], string> = {
  urgent: "bg-rose-400",
  important: "bg-amber-400",
  todo: "bg-violet-400",
  other: "bg-white/35",
};

function shortPersonName(name: string) {
  const cleaned = name.replace(/\(toi\)/gi, "").trim();
  const first = cleaned.split(/\s+/)[0];
  return first || cleaned || "Référent";
}

function TaskPersonBubble({
  userId,
  name,
  avatarUrl,
  mine,
}: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  mine: boolean;
}) {
  const lookup = useDiscordUser(isDiscordSnowflake(userId) ? userId : null);
  const shown =
    discordDisplayName(lookup, name) || shortPersonName(name);
  const label = shortPersonName(shown);

  return (
    <Link
      href={mine ? "/dashboard/profil" : `/dashboard/referents/${encodeURIComponent(userId)}`}
      title={mine ? `${shown} · c’est toi` : `Profil de ${shown}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 transition-colors hover:bg-white/[0.1]",
        mine
          ? "bg-violet-500/22 ring-1 ring-violet-300/45"
          : "bg-white/[0.06] ring-1 ring-white/10"
      )}
    >
      <DiscordDecoratedAvatar
        name={shown}
        url={avatarUrl || lookup?.avatarUrl}
        decorationUrl={lookup?.decorationUrl}
        userId={userId}
        size={28}
        ringClassName="ring-2 ring-black/45"
      />
      <span className="max-w-[7.5rem] truncate text-[12px] font-medium text-white">
        {label}
      </span>
      {mine ? (
        <span className="shrink-0 text-[9px] font-medium tracking-wide text-violet-200 uppercase">
          toi
        </span>
      ) : null}
    </Link>
  );
}

function HomeTaskCard({
  task,
  accountId,
  referents,
  onDone,
}: {
  task: PlanningSlot;
  accountId: string;
  referents: RefgmAccount[];
  onDone: () => void;
}) {
  const people = [...task.assignees].sort((a, b) => {
    if (a.userId === accountId) return -1;
    if (b.userId === accountId) return 1;
    return a.userName.localeCompare(b.userName, "fr");
  });
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  const isShift = task.kind === "shift";
  const title = task.title || (isShift ? "Permanence" : "Tâche");
  const day = formatTaskDate(task.date);
  const time = [task.start, task.end].filter(Boolean).join(" → ");

  return (
    <li className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          PRIORITY_BAR[task.priority]
        )}
      />
      <div className="flex gap-3 py-3.5 pr-3 pl-4 sm:gap-4 sm:pr-4 sm:pl-5">
        <div
          className={cn(
            "mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex",
            isShift
              ? "bg-emerald-400/12 text-emerald-200"
              : "bg-violet-400/14 text-violet-200"
          )}
        >
          {isShift ? (
            <CalendarClock className="h-4 w-4" />
          ) : (
            <ListChecks className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/60 uppercase">
              {isShift ? "Permanence" : "Tâche"}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                PRIORITY_TONE[task.priority]
              )}
            >
              {PLANNING_PRIORITY_LABEL[task.priority]}
            </span>
          </div>
          <p className="text-[15px] leading-snug font-semibold tracking-tight text-white">
            {title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
            {day ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1">
                <CalendarClock className="h-3 w-3 text-white/35" />
                {day}
              </span>
            ) : null}
            {time ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1">
                <Clock className="h-3 w-3 text-white/35" />
                {time}
              </span>
            ) : null}
            {task.assignedByName ? (
              <span className="px-0.5 text-white/38">
                par {task.assignedByName}
              </span>
            ) : null}
          </div>
          {task.note ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-white/58">
              {task.note}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {people.length === 0 ? (
              <span className="text-[11px] text-white/35">Personne</span>
            ) : (
              <>
                {shown.map((m) => (
                  <TaskPersonBubble
                    key={m.userId}
                    userId={m.userId}
                    name={m.userName}
                    avatarUrl={
                      referents.find((a) => a.userId === m.userId)
                        ?.discordAvatarUrl
                    }
                    mine={m.userId === accountId}
                  />
                ))}
                {extra > 0 ? (
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-2 text-[11px] font-medium text-white/55">
                    +{extra}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="rg-btn mt-0.5 h-9 shrink-0 gap-1.5 self-start px-3 text-[11px]"
          onClick={onDone}
        >
          <Check className="h-3.5 w-3.5" />
          Fait
        </button>
      </div>
    </li>
  );
}

const listMotion: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

const itemMotion: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

export function ReferentHome({ userName }: { userName?: string | null }) {
  const { account, grade } = useAccount();
  const dashUser = useDashboardUser();
  const [pendingAccounts, setPendingAccounts] = useState<RefgmAccount[]>([]);
  const [pendingAccountCount, setPendingAccountCount] = useState(0);
  const [tasks, setTasks] = useState<PlanningSlot[]>([]);
  const [referents, setReferents] = useState<RefgmAccount[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refreshAccounts = () => {
      void listPendingAccounts().then(setPendingAccounts);
      void countPendingAccounts().then(setPendingAccountCount);
      void listAllAccounts().then((list) => {
        setReferents(
          list.filter((a) => a.status === "APPROVED")
        );
      });
    };
    const refreshTasks = () => {
      setTasks(listOpenTasksForUser(account.userId, account.displayName));
    };
    refreshAccounts();
    refreshTasks();
    setReady(true);
    window.addEventListener("refgm:accounts-updated", refreshAccounts);
    window.addEventListener("refgm:staff-updated", refreshAccounts);
    window.addEventListener("refgm:planning-updated", refreshTasks);
    window.addEventListener("storage", refreshAccounts);
    window.addEventListener("storage", refreshTasks);
    return () => {
      window.removeEventListener("refgm:accounts-updated", refreshAccounts);
      window.removeEventListener("refgm:staff-updated", refreshAccounts);
      window.removeEventListener("refgm:planning-updated", refreshTasks);
      window.removeEventListener("storage", refreshAccounts);
      window.removeEventListener("storage", refreshTasks);
    };
  }, [account.userId, account.displayName]);

  const gradeDef = getGradeDef(grade);
  const gradeLabel = getGradeLabel(grade);

  const display = defaultProfile({
    userId: account.userId,
    name: userName || account.displayName,
    image: dashUser.image || account.discordAvatarUrl,
    discordLinked: account.discordLinked || dashUser.discordLinked,
    discordId:
      dashUser.discordId ||
      (displayDiscordId(account.userId) || account.userId),
    bannerUrl: dashUser.discordBannerUrl,
    decorationUrl: dashUser.discordDecorationUrl,
    accent: dashUser.discordAccent,
  });
  display.manualBadges = getProfile(account.userId)?.manualBadges ?? [];
  const storedBanner = getProfile(account.userId)?.bannerDataUrl;
  if (storedBanner) display.bannerDataUrl = storedBanner;

  const shortcuts = [
    {
      href: "/dashboard/suivi-groupes",
      label: "Suivi groupes",
      hint: "Missions et récap or",
      icon: ClipboardPaste,
      tone: "bg-violet-500/15 text-violet-200",
    },
    {
      href: "/dashboard/groupes",
      label: "Groupes",
      hint: "Ajouter ou retirer un groupe",
      icon: Users,
      tone: "bg-violet-500/12 text-violet-100",
    },
    {
      href: "/dashboard/planning",
      label: "Planning",
      hint: "Créneaux et tâches",
      icon: ListChecks,
      tone: "bg-white/[0.08] text-white/80",
    },
    {
      href: "/dashboard/trames",
      label: "Trames",
      hint: "Avancement GM",
      icon: Map,
      tone: "bg-violet-500/10 text-violet-200",
    },
  ];

  return (
    <StaffPageShell
      showBack={false}
      className="max-w-7xl"
      title="Accueil"
      description="Ton espace de travail : missions, tâches et raccourcis."
      ready={ready}
      actions={
        canVerifyAccounts(grade) && pendingAccountCount > 0 ? (
          <Link href="/dashboard/validation" className="rg-btn">
            {pendingAccountCount} en file
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : undefined
      }
    >
      <motion.div
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17.5rem]"
        variants={listMotion}
        initial="hidden"
        animate="show"
      >
        <div className="space-y-5">
        <motion.div variants={itemMotion}>
          <ProfileCard
            variant="banner"
            profile={display}
            roleLabel={gradeLabel}
            roleColor={gradeDef.color}
            gradeId={grade}
            href="/dashboard/profil"
            welcome="Bienvenue dans ton espace Référent GM. Retrouve tes missions, demandes et prochaines actions."
            actions={
              <HomeMissionLog label="Noter une mission" />
            }
          />
        </motion.div>

        <div className="grid items-start gap-5 lg:grid-cols-12">
          <motion.div variants={itemMotion} className="space-y-5 lg:col-span-8">

            <section className="rg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                    <ListChecks className="h-4 w-4" />
                  </span>
                  Tes tâches
                  {tasks.length ? (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-100">
                      {tasks.length}
                    </span>
                  ) : null}
                </p>
                <Link
                  href="/dashboard/planning"
                  className="text-xs text-white/40 hover:text-white/80"
                >
                  Planning
                </Link>
              </div>
              {tasks.length ? (
                <ul className="space-y-2.5 px-3 pb-4 sm:px-4">
                  {tasks.map((task) => (
                    <HomeTaskCard
                      key={task.id}
                      task={task}
                      accountId={account.userId}
                      referents={referents}
                      onDone={() => setPlanningStatus(task.id, "done")}
                    />
                  ))}
                </ul>
              ) : (
                <div className="mx-3 mb-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center sm:mx-4">
                  <p className="text-sm text-white/45">
                    Rien à ton nom pour l’instant.
                  </p>
                  <p className="mt-1 text-[12px] text-white/32">
                    Un créneau du planning apparaît ici dès qu’on t’y colle.
                  </p>
                  <Link
                    href="/dashboard/planning"
                    className="mt-3 inline-flex text-xs text-violet-200/80 hover:text-violet-100"
                  >
                    Ouvrir le planning
                  </Link>
                </div>
              )}
            </section>
          </motion.div>

          <motion.div variants={itemMotion} className="lg:col-span-4">
            <div className="rg-card flex flex-col overflow-hidden">
              <p className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-white">
                Raccourcis
              </p>
              <div className="flex flex-col">
                {shortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          item.tone
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-white/40">
                          {item.hint}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/0 transition group-hover:text-white/35" />
                    </Link>
                  );
                })}
              </div>

              {canVerifyAccounts(grade) ? (
                <>
                  <div
                    className="mx-4 my-1 h-px bg-white/[0.08]"
                    aria-hidden
                  />
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-semibold text-white">
                      File Discord
                    </p>
                    <Link
                      href="/dashboard/validation"
                      className="text-xs text-white/40 hover:text-white/80"
                    >
                      Ouvrir
                    </Link>
                  </div>
                  {pendingAccounts.length ? (
                    pendingAccounts.slice(0, 4).map((row) => (
                      <Link
                        key={row.userId}
                        href="/dashboard/validation"
                        className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-2.5 hover:bg-white/[0.03]"
                      >
                        <DiscordDecoratedAvatar
                          name={row.displayName}
                          url={row.discordAvatarUrl}
                          userId={row.userId}
                          size={36}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                          {row.displayName}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="px-4 pb-4 text-sm text-white/40">
                      Aucun compte en attente.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
        </div>
        <motion.div variants={itemMotion}>
          <ReferentsRosterPanel
            accounts={referents.filter((a) => isListedReferent(a.grade))}
          />
        </motion.div>
      </motion.div>
    </StaffPageShell>
  );
}

export function useIsReferentStaff() {
  const { grade } = useAccount();
  return isReferent(grade);
}
