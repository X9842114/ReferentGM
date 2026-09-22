"use client";

import { useAccount } from "@/components/account-context";
import { DiscordAvatar } from "@/components/actor-trace";
import { EmptyHint } from "@/components/empty-hint";
import { useOnlineReferents } from "@/components/online-referents";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  countPendingAccounts,
  listAllAccounts,
  type RefgmAccount,
} from "@/lib/accounts";
import { listGroupRewards, statsByGroupId } from "@/lib/group-reward-log";
import {
  canVerifyAccounts,
  isGameMaster,
  isListedReferent,
  isReferent,
} from "@/lib/permissions";
import {
  presenceAgo,
  presencePageLabel,
} from "@/lib/referent-presence";
import { listPlanningSlots } from "@/lib/referent-planning";
import { GROUP_KIND_LABEL, listRpGroups } from "@/lib/rp-groups";
import {
  activityLevelLabel,
  buildStaffActivityReport,
  countUnrewardedDiscordMissions,
  type StaffActivityRow,
} from "@/lib/staff-activity-report";
import {
  createWarning,
  deleteMeetingReminder,
  deleteWarning,
  listBroadcasts,
  listMeetingReminders,
  listWarnings,
  saveMeetingReminder,
  sendBroadcast,
  warningsForUser,
  type MeetingReminder,
  type StaffBroadcast,
  type StaffWarning,
} from "@/lib/supervision";
import { cn } from "@/lib/utils";
import {
  Bell,
  CalendarClock,
  Coins,
  Crosshair,
  Eye,
  Landmark,
  Megaphone,
  TriangleAlert,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type TabId = "equipe" | "alertes" | "meetings" | "broadcast" | "warns";

function daysAgoLabel(days: number | null) {
  if (days == null) return "jamais";
  if (days === 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

function todayIsoDate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function SupervisionPanel() {
  const { account, grade } = useAccount();
  const peers = useOnlineReferents();
  const [tab, setTab] = useState<TabId>("equipe");
  const [accounts, setAccounts] = useState<RefgmAccount[]>([]);
  const [rows, setRows] = useState<StaffActivityRow[]>([]);
  const [reminders, setReminders] = useState<MeetingReminder[]>([]);
  const [broadcasts, setBroadcasts] = useState<StaffBroadcast[]>([]);
  const [warnings, setWarnings] = useState<StaffWarning[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [meetTitle, setMeetTitle] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [meetNote, setMeetNote] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [warnTarget, setWarnTarget] = useState("");
  const [warnReason, setWarnReason] = useState("");

  const refreshStaff = useCallback(() => {
    setReminders(listMeetingReminders());
    setBroadcasts(listBroadcasts());
    setWarnings(listWarnings());
  }, []);

  const refreshOps = useCallback(() => {
    void listAllAccounts().then((list) => {
      const approved = list.filter((a) => a.status === "APPROVED");
      setAccounts(approved);
      setRows(
        buildStaffActivityReport(approved).filter((r) => r.kind === "REFERENT")
      );
    });
    void countPendingAccounts().then(setPendingCount);
    refreshStaff();
  }, [refreshStaff]);

  useEffect(() => {
    refreshOps();
    const events = [
      "refgm:staff-updated",
      "refgm:accounts-updated",
      "refgm:group-rewards-updated",
      "refgm:planning-updated",
      "refgm:discord-missions-updated",
      "refgm:rp-groups-updated",
    ] as const;
    for (const event of events) window.addEventListener(event, refreshOps);
    const tick = window.setInterval(() => setNow(Date.now()), 12_000);
    return () => {
      for (const event of events)
        window.removeEventListener(event, refreshOps);
      window.clearInterval(tick);
    };
  }, [refreshOps]);

  const referents = useMemo(
    () => accounts.filter((a) => isListedReferent(a.grade)),
    [accounts]
  );
  const targets = useMemo(
    () =>
      accounts.filter((a) => isReferent(a.grade) || isGameMaster(a.grade)),
    [accounts]
  );

  const onlineMap = useMemo(
    () => new Map(peers.map((peer) => [peer.userId, peer])),
    [peers]
  );
  const onlineReferents = referents.filter((r) => onlineMap.has(r.userId));

  const quietGroups = useMemo(() => {
    const stats = statsByGroupId(listGroupRewards());
    const cutoff = Date.now() - 14 * 86_400_000;
    return listRpGroups()
      .map((group) => {
        const s = stats[group.id];
        return {
          ...group,
          lastAt: s?.lastAt ?? null,
          count: s?.count ?? 0,
        };
      })
      .filter(
        (group) =>
          !group.lastAt || new Date(group.lastAt).getTime() < cutoff
      )
      .sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return ta - tb;
      });
  }, [rows]);

  const planning = useMemo(() => listPlanningSlots(), [rows]);
  const today = todayIsoDate();
  const todaySlots = planning.filter(
    (slot) => slot.date === today && slot.status === "open"
  );
  const planningOpen = planning.filter((slot) => slot.status === "open").length;
  const discordOpen = countUnrewardedDiscordMissions();
  const sleepy = rows.filter(
    (r) => r.level === "inactive" || r.level === "low"
  );
  const showValidation = canVerifyAccounts(grade);

  const field = "rg-field mt-1";

  const tools: {
    href: string;
    label: string;
    hint: string;
    icon: LucideIcon;
    count?: number;
    tone?: "warn" | "ok";
    hide?: boolean;
  }[] = [
    {
      href: "/dashboard/validation",
      label: "Validation",
      hint: "Comptes à valider",
      icon: UserRoundCheck,
      count: pendingCount,
      tone: pendingCount > 0 ? "warn" : "ok",
      hide: !showValidation,
    },
    {
      href: "/dashboard/planning",
      label: "Planning",
      hint: "Créneaux ouverts",
      icon: CalendarClock,
      count: planningOpen,
    },
    {
      href: "/dashboard/suivi-groupes",
      label: "Suivi groupes",
      hint: "Missions Discord sans or",
      icon: Coins,
      count: discordOpen,
      tone: discordOpen > 0 ? "warn" : "ok",
    },
    {
      href: "/dashboard/missions-gm",
      label: "Missions GM",
      hint: "Groupes missionnés par cellule",
      icon: Crosshair,
    },
    {
      href: "/dashboard/groupes",
      label: "Groupes",
      hint: "Sans suivi depuis 14 j",
      icon: Landmark,
      count: quietGroups.length,
      tone: quietGroups.length > 8 ? "warn" : "ok",
    },
    {
      href: "/dashboard/referents",
      label: "Référents",
      hint: `${referents.length} fiches`,
      icon: UsersRound,
      count: onlineReferents.length,
    },
    {
      href: "/dashboard/rapports",
      label: "Rapports",
      hint: "Qui note, qui tourne",
      icon: Eye,
    },
  ];

  return (
    <StaffPageShell
      title="Supervision"
      description="Pilote l’équipe : qui est en ligne, qui note les missions, qui est sur le planning, et les groupes sans suivi."
      className="max-w-6xl"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tools
          .filter((tool) => !tool.hide)
          .map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={cn(
                  "rg-card flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.04]",
                  tool.tone === "warn" && "border-amber-400/25"
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/12 text-violet-200">
                  <Icon strokeWidth={1.75} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white/85">
                    {tool.label}
                  </span>
                  <span className="block text-[11px] text-white/38">
                    {tool.hint}
                  </span>
                </span>
                {tool.count != null ? (
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      tool.tone === "warn"
                        ? "text-amber-200"
                        : "text-white/80"
                    )}
                  >
                    {tool.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
      </div>

      <div className="rg-metric-bar sm:!grid-cols-2 lg:!grid-cols-4">
        {(
          [
            ["En ligne", onlineReferents.length],
            ["Référents peu actifs", sleepy.length],
            ["Planning aujourd’hui", todaySlots.length],
            ["Avertissements", warnings.length],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[11px] text-white/40">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["equipe", "Équipe", rows.length],
            ["alertes", "À regarder", sleepy.length + quietGroups.length],
            ["meetings", "Réunions", reminders.length],
            ["broadcast", "Messages", broadcasts.length],
            ["warns", "Avertissements", warnings.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs",
              tab === id
                ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                : "border-white/10 text-white/45 hover:text-white"
            )}
          >
            {label} · {n}
          </button>
        ))}
      </div>

      {tab === "equipe" ? (
        <section className="space-y-4">
          {todaySlots.length > 0 ? (
            <div className="rg-card p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-white/80">
                <CalendarClock className="h-4 w-4 text-violet-300" />
                Planning du jour
              </p>
              <ul className="mt-3 space-y-2">
                {todaySlots.slice(0, 8).map((slot) => (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="text-white/80">
                      {slot.title ||
                        (slot.kind === "shift" ? "Permanence" : "Créneau")}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {[slot.start, slot.end].filter(Boolean).join(" à ")}
                      {slot.userName ? ` · ${slot.userName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/planning"
                className="mt-3 inline-block text-[11px] text-violet-300 hover:text-violet-100"
              >
                Ouvrir le planning
              </Link>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <EmptyHint
              icon={<UsersRound className="h-6 w-6" />}
              title="Aucun référent"
              hint="Dès qu’un compte référent est validé, son suivi missions et planning apparaît ici."
            />
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const live = onlineMap.get(row.userId);
                const warns = warningsForUser(row.userId).length;
                return (
                  <div
                    key={row.userId}
                    className="rg-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <DiscordAvatar
                        name={row.displayName}
                        url={row.avatarUrl}
                        userId={row.userId}
                        size={36}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white/90">
                          {row.displayName}
                        </p>
                        <p className="text-[11px] text-white/38">
                          {row.gradeLabel}
                          {live
                            ? ` · ${presencePageLabel(live.path)} · ${presenceAgo(live.at, now)}`
                            : ` · ${daysAgoLabel(row.daysSinceActive)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5",
                          row.level === "active" &&
                            "border-emerald-400/30 text-emerald-200",
                          row.level === "ok" &&
                            "border-violet-400/30 text-violet-200",
                          row.level === "low" &&
                            "border-amber-400/30 text-amber-200",
                          row.level === "inactive" &&
                            "border-rose-400/30 text-rose-200"
                        )}
                      >
                        {live ? "En ligne" : activityLevelLabel(row.level)}
                      </span>
                      <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-white/55">
                        {row.suiviCount} suivi
                      </span>
                      <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-white/55">
                        {row.orLogged} or
                      </span>
                      <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-white/55">
                        {row.planningOpen} planning
                      </span>
                      {warns > 0 ? (
                        <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-100">
                          {warns} avis
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {tab === "alertes" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">
              Référents à relancer
            </p>
            {sleepy.length === 0 ? (
              <p className="text-xs text-white/35">
                Tout le monde a tourné récemment.
              </p>
            ) : (
              sleepy.map((row) => (
                <div key={row.userId} className="rg-card p-3">
                  <p className="text-sm text-white/85">{row.displayName}</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {row.improvements[0] || daysAgoLabel(row.daysSinceActive)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">
              Groupes sans suivi (14 j)
            </p>
            {quietGroups.length === 0 ? (
              <p className="text-xs text-white/35">
                Tous les groupes ont un suivi récent.
              </p>
            ) : (
              quietGroups.slice(0, 12).map((group) => (
                <Link
                  key={group.id}
                  href="/dashboard/suivi-groupes"
                  className="rg-card flex items-center justify-between p-3 hover:bg-white/[0.04]"
                >
                  <span>
                    <span className="block text-sm text-white/85">
                      {group.name}
                    </span>
                    <span className="text-[11px] text-white/38">
                      {GROUP_KIND_LABEL[group.kind]}
                      {group.lastAt
                        ? ` · dernier ${new Date(group.lastAt).toLocaleDateString("fr-FR")}`
                        : " · jamais noté"}
                    </span>
                  </span>
                  <span className="text-[11px] text-white/30">
                    {group.count} missions
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "meetings" ? (
        <section className="space-y-4">
          <div className="rg-card space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Bell className="h-4 w-4 text-violet-300" /> Rappel de réunion
            </p>
            <input
              value={meetTitle}
              onChange={(e) => setMeetTitle(e.target.value)}
              placeholder="Titre"
              className={field}
            />
            <input
              type="datetime-local"
              value={meetAt}
              onChange={(e) => setMeetAt(e.target.value)}
              className={field}
            />
            <textarea
              value={meetNote}
              onChange={(e) => setMeetNote(e.target.value)}
              placeholder="Note"
              rows={2}
              className={cn(field, "resize-none")}
            />
            <button
              type="button"
              disabled={!meetTitle.trim() || !meetAt}
              onClick={() => {
                saveMeetingReminder({
                  title: meetTitle,
                  meetingAt: new Date(meetAt).toISOString(),
                  note: meetNote,
                  createdById: account.userId,
                  createdByName: account.displayName,
                });
                setMeetTitle("");
                setMeetAt("");
                setMeetNote("");
                refreshStaff();
              }}
              className="rg-btn rg-btn-primary disabled:opacity-40"
            >
              Envoyer le rappel
            </button>
          </div>
          {reminders.length === 0 ? (
            <EmptyHint
              icon={<Bell className="h-6 w-6" />}
              title="Aucun rappel"
              hint="Planifie une date : l’équipe verra le rappel ici."
            />
          ) : (
            reminders.map((r) => (
              <div
                key={r.id}
                className="rg-card flex items-start justify-between p-3"
              >
                <div>
                  <p className="text-sm text-white/85">{r.title}</p>
                  <p className="text-xs text-white/40">
                    {new Date(r.meetingAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteMeetingReminder(r.id);
                    refreshStaff();
                  }}
                  className="text-[11px] text-white/30"
                >
                  Suppr.
                </button>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "broadcast" ? (
        <section className="space-y-4">
          <div className="rg-card space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Megaphone className="h-4 w-4 text-violet-300" /> Message aux
              référents
            </p>
            <input
              value={bcTitle}
              onChange={(e) => setBcTitle(e.target.value)}
              placeholder="Titre"
              className={field}
            />
            <textarea
              value={bcBody}
              onChange={(e) => setBcBody(e.target.value)}
              placeholder="Message"
              rows={3}
              className={cn(field, "resize-none")}
            />
            <button
              type="button"
              disabled={!bcTitle.trim() || !bcBody.trim()}
              onClick={() => {
                void sendBroadcast({
                  title: bcTitle,
                  body: bcBody,
                  audience: "REFERENTS",
                  createdById: account.userId,
                  createdByName: account.displayName,
                }).then(() => {
                  setBcTitle("");
                  setBcBody("");
                  refreshStaff();
                });
              }}
              className="rg-btn rg-btn-primary disabled:opacity-40"
            >
              Diffuser
            </button>
          </div>
          {broadcasts.length === 0 ? (
            <EmptyHint
              icon={<Megaphone className="h-6 w-6" />}
              title="Aucun message"
              hint="Diffuse une consigne à tous les référents : l’historique reste ici."
            />
          ) : (
            broadcasts.slice(0, 8).map((b) => (
              <div key={b.id} className="rg-card p-3">
                <p className="text-sm text-white/85">{b.title}</p>
                <p className="mt-1 text-xs text-white/45">{b.body}</p>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "warns" ? (
        <section className="space-y-4">
          <div className="rg-card space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <TriangleAlert className="h-4 w-4 text-violet-300" />{" "}
              Avertissement
            </p>
            <select
              value={warnTarget}
              onChange={(e) => setWarnTarget(e.target.value)}
              className={field}
            >
              <option value="">Choisir un compte…</option>
              {targets.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.displayName} ({t.grade})
                </option>
              ))}
            </select>
            <textarea
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              placeholder="Motif"
              rows={2}
              className={cn(field, "resize-none")}
            />
            <button
              type="button"
              disabled={!warnTarget || !warnReason.trim()}
              onClick={() => {
                const t = targets.find((x) => x.userId === warnTarget);
                if (!t) return;
                createWarning({
                  targetUserId: t.userId,
                  targetName: t.displayName,
                  reason: warnReason,
                  createdById: account.userId,
                  createdByName: account.displayName,
                });
                setWarnTarget("");
                setWarnReason("");
                refreshStaff();
              }}
              className="rg-btn disabled:opacity-40"
            >
              Enregistrer l’avertissement
            </button>
          </div>
          {warnings.length === 0 ? (
            <EmptyHint
              icon={<TriangleAlert className="h-6 w-6" />}
              title="Aucun avertissement"
              hint="Le dossier reste vide tant qu’aucun compte n’a été signalé."
            />
          ) : (
            warnings.map((w) => (
              <div
                key={w.id}
                className="rg-card flex items-start justify-between p-3"
              >
                <div>
                  <p className="text-sm text-white/85">{w.targetName}</p>
                  <p className="mt-1 text-xs text-white/45">{w.reason}</p>
                  <p className="mt-1 text-[10px] text-white/30">
                    {w.createdByName} ·{" "}
                    {new Date(w.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteWarning(w.id);
                    refreshStaff();
                  }}
                  className="text-[11px] text-white/30"
                >
                  Suppr.
                </button>
              </div>
            ))
          )}
        </section>
      ) : null}
    </StaffPageShell>
  );
}
