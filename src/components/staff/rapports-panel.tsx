"use client";

import { useAccount } from "@/components/account-context";
import { DiscordAvatar } from "@/components/actor-trace";
import { EmptyHint } from "@/components/empty-hint";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { getAccountSync, listAllAccounts } from "@/lib/accounts";
import { listGroupRewards, recapGroupRewards } from "@/lib/group-reward-log";
import { listMissions, sumOrRewards } from "@/lib/mission-storage";
import { isDeveloper, isGameMaster, isReferent } from "@/lib/permissions";
import { listPlanningSlots } from "@/lib/referent-planning";
import { listRpGroups } from "@/lib/rp-groups";
import {
  activityLevelLabel,
  buildStaffActivityReport,
  countUnrewardedDiscordMissions,
  type StaffActivityRow,
} from "@/lib/staff-activity-report";
import {
  deleteReport,
  listBlacklist,
  listReports,
  saveReport,
  type MeetingReport,
} from "@/lib/staff-storage";
import { cn } from "@/lib/utils";
import { Check, FilePlus2, Trash2, TriangleAlert, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Brief = {
  refs: number;
  gms: number;
  pendingMissions: number;
  blacklist: number;
  orSuiviBleu: number;
  orSuiviRouge: number;
  orGmBleu: number;
  orGmRouge: number;
  orGmPending: number;
  catalog: number;
  suivi: number;
  planningOpen: number;
  discordOpen: number;
};

const EMPTY_BRIEF: Brief = {
  refs: 0,
  gms: 0,
  pendingMissions: 0,
  blacklist: 0,
  orSuiviBleu: 0,
  orSuiviRouge: 0,
  orGmBleu: 0,
  orGmRouge: 0,
  orGmPending: 0,
  catalog: 0,
  suivi: 0,
  planningOpen: 0,
  discordOpen: 0,
};

export function RapportsPanel() {
  const { account } = useAccount();
  const [reports, setReports] = useState<MeetingReport[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"staff" | "briefings">("staff");
  const [rows, setRows] = useState<StaffActivityRow[]>([]);
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    setReports(listReports());
    void listAllAccounts().then((remote) => {
      const extraIds = new Set<string>();
      for (const row of listGroupRewards()) {
        extraIds.add(row.loggedBy);
        if (row.gmUserId) extraIds.add(row.gmUserId);
      }
      for (const slot of listPlanningSlots()) {
        extraIds.add(slot.createdBy);
        extraIds.add(slot.assignedById);
        extraIds.add(slot.userId);
      }
      const seen = new Set(remote.map((a) => a.userId));
      const accounts = [...remote];
      for (const id of extraIds) {
        if (!id || seen.has(id)) continue;
        const local = getAccountSync(id);
        if (local) {
          seen.add(id);
          accounts.push(local);
        }
      }
      const approved = accounts.filter((a) => a.status === "APPROVED");
      const missions = listMissions();
      const pending = missions.filter((m) => m.status === "pending_review");
      const approvedM = missions.filter((m) => m.status === "approved");
      const or = sumOrRewards(approvedM);
      const suivi = recapGroupRewards(listGroupRewards());
      setRows(buildStaffActivityReport(accounts));
      setBrief({
        refs: approved.filter(
          (a) => isReferent(a.grade) && !isDeveloper(a.grade)
        ).length,
        gms: approved.filter((a) => isGameMaster(a.grade)).length,
        pendingMissions: pending.length,
        blacklist: listBlacklist().filter((b) => b.active).length,
        orSuiviRouge: suivi.rouge,
        orSuiviBleu: suivi.bleu,
        orGmBleu: or.bleu,
        orGmRouge: or.rouge,
        orGmPending: sumOrRewards(pending).total,
        catalog: listRpGroups().length,
        suivi: suivi.count,
        planningOpen: listPlanningSlots().filter((s) => s.status === "open")
          .length,
        discordOpen: countUnrewardedDiscordMissions(),
      });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    load();
    const events = [
      "refgm:staff-updated",
      "refgm:missions-updated",
      "refgm:group-rewards-updated",
      "refgm:rp-groups-updated",
      "refgm:planning-updated",
      "refgm:discord-missions-updated",
      "refgm:accounts-updated",
    ] as const;
    for (const event of events) window.addEventListener(event, load);
    return () => {
      for (const event of events) window.removeEventListener(event, load);
    };
  }, [load]);

  const inactiveCount = rows.filter(
    (r) => r.level === "inactive" || r.level === "low"
  ).length;

  const snapshotText = useMemo(() => {
    const lines = [
      `Snapshot · ${new Date().toLocaleString("fr-FR")}`,
      `Référents : ${brief.refs}`,
      `GameMasters : ${brief.gms}`,
      `Groupes : ${brief.catalog}`,
      `Missions notées : ${brief.suivi}`,
      `Missions Discord sans or : ${brief.discordOpen}`,
      `Missions en attente : ${brief.pendingMissions}`,
      `Blacklist actives : ${brief.blacklist}`,
      `Or du suivi : ${brief.orSuiviBleu} bleu / ${brief.orSuiviRouge} rouge`,
      `Tâches planning ouvertes : ${brief.planningOpen}`,
      `Personnes peu actives : ${inactiveCount}`,
      "",
      "À regarder",
      ...rows
        .filter((r) => r.level === "inactive" || r.level === "low")
        .slice(0, 12)
        .map(
          (r) =>
            `• ${r.displayName} (${r.gradeLabel}) · ${activityLevelLabel(r.level)} · ${r.improvements[0] ?? "peu d’activité"}`
        ),
    ];
    return lines.join("\n");
  }, [brief, inactiveCount, rows]);

  function create() {
    saveReport({
      title: title.trim() || `Briefing ${new Date().toLocaleDateString("fr-FR")}`,
      body: body.trim() || snapshotText,
      meetingAt: new Date().toISOString(),
      authorId: account.userId,
      authorName: account.displayName,
    });
    setTitle("");
    setBody("");
    setReports(listReports());
  }

  return (
    <StaffPageShell
      title="Rapports"
      description="Qui a noté des missions, suivi des groupes ou du planning. Les notes de réunion sont dans l’autre onglet."
      className="max-w-6xl"
      ready={ready}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs",
            tab === "staff"
              ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
              : "border-white/10 text-white/40"
          )}
        >
          Activité
        </button>
        <button
          type="button"
          onClick={() => setTab("briefings")}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs",
            tab === "briefings"
              ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
              : "border-white/10 text-white/40"
          )}
        >
          Notes de réunion
        </button>
      </div>

      <div className="rg-metric-bar sm:!grid-cols-3 lg:!grid-cols-6">
        {(
          [
            ["Référents", brief.refs, null],
            ["GM", brief.gms, null],
            ["Missions notées", brief.suivi, "dans le suivi groupes"],
            ["Or donné", brief.orSuiviBleu + brief.orSuiviRouge, `${brief.orSuiviBleu} bleu · ${brief.orSuiviRouge} rouge`],
            ["Planning", brief.planningOpen, "tâches ouvertes"],
            ["Discord", brief.discordOpen, "sans or encore"],
          ] as const
        ).map(([label, value, hint]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[11px] text-white/40">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">
              {value}
            </p>
            {hint ? (
              <p className="mt-0.5 text-[10px] text-white/30">{hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      {tab === "staff" ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="h-4 w-4" />
            L’équipe : missions notées, planning et Discord
          </div>
          {rows.length === 0 ? (
            <EmptyHint
              icon={<Users className="h-7 w-7" />}
              title="Personne à afficher"
              hint="Les comptes validés apparaissent ici avec leurs missions, leur planning et Discord."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {rows.map((row) => {
                const alert =
                  row.kind !== "DEV" &&
                  (row.level === "inactive" || row.level === "low");
                return (
                  <article
                    key={row.userId}
                    className={cn(
                      "rg-card p-4",
                      alert ? "border-rose-500/40 bg-rose-500/[0.08]" : ""
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <DiscordAvatar
                        name={row.displayName}
                        url={row.avatarUrl}
                        userId={row.userId}
                        size={44}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="truncate text-sm font-medium text-white/90">
                              {row.displayName}
                            </p>
                            <p className="text-[11px] text-white/40">
                              {row.kindLabel === row.gradeLabel
                                ? row.gradeLabel
                                : `${row.gradeLabel} · ${row.kindLabel}`}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              row.level === "active" &&
                                "bg-emerald-500/15 text-emerald-100",
                              row.level === "ok" &&
                                "bg-violet-500/15 text-violet-100",
                              row.level === "low" &&
                                "bg-amber-500/15 text-amber-100",
                              row.level === "inactive" &&
                                "bg-rose-500/20 text-rose-100"
                            )}
                          >
                            {activityLevelLabel(row.level)}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/45 sm:grid-cols-4">
                          {row.kind === "GAMEMASTER" ? (
                            <>
                              <Stat tip="Discord" v={row.discordMissions} />
                              <Stat tip="Suivi" v={row.suiviCount} />
                              <Stat tip="Missions" v={row.missionsProposed} />
                              <Stat tip="Validées" v={row.missionsApproved} />
                            </>
                          ) : (
                            <>
                              <Stat tip="Suivi" v={row.suiviCount} />
                              <Stat tip="Or donné" v={row.orLogged} />
                              <Stat
                                tip="Planning"
                                v={`${row.planningOpen}/${row.planningTotal}`}
                              />
                              <Stat tip="Discord" v={row.discordImported} />
                            </>
                          )}
                        </div>

                        <p className="mt-2 text-[11px] text-white/35">
                          Dernière action ·{" "}
                          {row.lastActiveAt
                            ? new Date(row.lastActiveAt).toLocaleString("fr-FR")
                            : "aucune"}
                          {row.daysSinceActive != null
                            ? ` (${row.daysSinceActive} j)`
                            : ""}
                        </p>

                        {row.improvements.length ? (
                          <ul className="mt-3 space-y-1">
                            {row.improvements.map((tip) => (
                              <li
                                key={tip}
                                className="flex items-start gap-1.5 text-xs text-rose-100/85"
                              >
                                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        ) : row.level === "inactive" ? (
                          <p className="mt-3 text-xs text-white/40">
                            Aucune action récente à son nom
                          </p>
                        ) : (
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-100/70">
                            <Check className="h-3 w-3 shrink-0" />
                            Rien de bloquant
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="rg-card space-y-3 p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre (ex. Point du dimanche)"
              className="rg-field"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notes de réunion. Laisse vide pour coller un résumé auto."
              className="rg-field min-h-36 resize-y"
            />
            <button
              type="button"
              onClick={create}
              className="rg-btn rg-btn-primary"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> Enregistrer
            </button>
          </section>

          {reports.length === 0 ? (
            <EmptyHint
              icon={<FilePlus2 className="h-7 w-7" />}
              title="Aucune note"
              hint="Écris le point d’équipe. Si tu laisses le texte vide, un résumé (missions, Discord, planning) est collé tout seul."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <article key={report.id} className="rg-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white/90">
                        {report.title}
                      </p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {report.authorName} ·{" "}
                        {new Date(report.meetingAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        deleteReport(report.id);
                        setReports(listReports());
                      }}
                      className="text-rose-300/80 hover:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white/55">
                    {report.body}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </StaffPageShell>
  );
}

function Stat({ tip, v }: { tip: string; v: string | number }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <p className="text-[9px] tracking-wide text-white/30 uppercase">{tip}</p>
      <p className="text-xs text-white/75">{v}</p>
    </div>
  );
}
