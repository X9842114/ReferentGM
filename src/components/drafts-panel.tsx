"use client";

import { useAccount } from "@/components/account-context";
import { ActorTraceStack, DiscordAvatar } from "@/components/actor-trace";
import { MissionReviewModeBadge } from "@/components/staff/mission-review-settings-panel";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import {
  canSeeReadChronometer,
  getMissionReviewSettings,
  type MissionReviewMode,
} from "@/lib/mission-settings";
import {
  castMissionVote,
  deleteMission,
  formatReadDuration,
  getUserVote,
  hasUserReadMission,
  listMissions,
  markMissionRead,
  reviewMission,
  submitMissionForReview,
  type StoredMission,
  type StoredMissionStatus,
} from "@/lib/mission-storage";
import { canProposeMissions, canReadMissions } from "@/lib/permissions";
import { listRpGroups } from "@/lib/rp-groups";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clock,
  Eye,
  Inbox,
  Scale,
  Send,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATUS_META: Record<
  StoredMissionStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Brouillon",
    className: "border-amber-400/25 bg-amber-500/10 text-amber-100/90",
  },
  pending_review: {
    label: "À traiter",
    className: "border-violet-400/25 bg-violet-500/10 text-violet-100/90",
  },
  approved: {
    label: "Validée",
    className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90",
  },
  rejected: {
    label: "Refusée",
    className: "border-rose-400/25 bg-rose-500/10 text-rose-100/90",
  },
};

function formatLive(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DraftsPanel() {
  const user = useDashboardUser();
  const { account, grade } = useAccount();
  const canPropose = canProposeMissions(grade);
  const canReview = canReadMissions(grade);
  const staffRead = canReview && !canPropose;
  const seeChrono = canSeeReadChronometer(grade);
  const [missions, setMissions] = useState<StoredMission[]>([]);
  const [mode, setMode] = useState<MissionReviewMode>("READ");
  const [quorum, setQuorum] = useState(2);
  const [filter, setFilter] = useState<"all" | StoredMissionStatus>(
    staffRead ? "pending_review" : "all"
  );
  const [selected, setSelected] = useState<StoredMission | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rejectReason, setRejectReason] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef<number>(0);

  const refresh = useCallback(() => {
    setMissions(listMissions());
    const s = getMissionReviewSettings();
    setMode(s.reviewMode);
    setQuorum(s.voteQuorum);
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:missions-updated", onUpdate);
    window.addEventListener("refgm:mission-settings-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("refgm:missions-updated", onUpdate);
      window.removeEventListener("refgm:mission-settings-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fits = el.scrollHeight <= el.clientHeight + 8;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    setReachedEnd(fits || atBottom);
  }, []);

  useEffect(() => {
    if (!selected || selected.status !== "pending_review") return;
    openedAtRef.current = Date.now();
    setElapsedMs(0);
    setReachedEnd(false);
    setRejectReason("");
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - openedAtRef.current);
    }, 250);
    const t = window.setTimeout(() => checkScroll(), 80);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const visible = missions.filter((m) =>
    filter === "all" ? true : m.status === filter
  );

  const selectedGroups = useMemo(
    () =>
      selected
        ? listRpGroups().filter((g) => selected.groupIds.includes(g.id))
        : [],
    [selected]
  );

  const alreadyRead = selected
    ? hasUserReadMission(selected, account.userId)
    : false;
  const myVote = selected ? getUserVote(selected, account.userId) : null;

  function remove(id: string) {
    deleteMission(id);
    if (selected?.id === id) setSelected(null);
    refresh();
  }

  function sendDraft(mission: StoredMission) {
    const updated = submitMissionForReview(mission);
    setSelected(updated);
    refresh();
  }

  function onMarkRead() {
    if (!selected || !reachedEnd) return;
    const durationMs = Date.now() - openedAtRef.current;
    const updated = markMissionRead({
      missionId: selected.id,
      userId: account.userId,
      displayName: account.displayName || user.name || "Référent",
      avatarUrl: account.discordAvatarUrl || user.image,
      durationMs,
    });
    if (updated) setSelected(updated);
    refresh();
  }

  function decide(mission: StoredMission, decision: "approved" | "rejected") {
    if (mode === "READ" && !hasUserReadMission(mission, account.userId)) return;
    setBusyId(mission.id);
    const updated = reviewMission({
      missionId: mission.id,
      decision,
      reviewerId: account.userId,
      reviewerName: account.displayName || user.name,
      avatarUrl: account.discordAvatarUrl || user.image,
    });
    if (updated) setSelected(updated);
    refresh();
    setBusyId(null);
  }

  function vote(decision: "approve" | "reject") {
    if (!selected) return;
    if (decision === "reject" && !rejectReason.trim()) return;
    setBusyId(selected.id);
    const { mission } = castMissionVote({
      missionId: selected.id,
      userId: account.userId,
      displayName: account.displayName || user.name || "Référent",
      avatarUrl: account.discordAvatarUrl || user.image,
      decision,
      reason: rejectReason,
    });
    if (mission) setSelected(mission);
    refresh();
    setBusyId(null);
  }

  const filterOptions = staffRead
    ? ([
        ["pending_review", "À traiter"],
        ["approved", "Validées"],
        ["rejected", "Refusées"],
        ["all", "Tout"],
      ] as const)
    : ([
        ["all", "Tout"],
        ["draft", "Brouillons"],
        ["pending_review", "En validation"],
        ["approved", "Validées"],
        ["rejected", "Refusées"],
      ] as const);

  return (
    <StaffPageShell
      title="Brouillons"
      description={
        staffRead
          ? mode === "READ"
            ? "Lis chaque mission jusqu’au bout, marque-la comme lue, puis valide."
            : `Vote pour ou contre chaque mission · quorum ${quorum}.`
          : "Rédige tes missions, envoie-les en validation et suis leur traitement."
      }
      actions={
        <>
          {canReview ? <MissionReviewModeBadge grade={grade} /> : null}
          {canPropose ? (
            <Link href="/dashboard" className="rg-btn rg-btn-primary">
              Nouvelle mission
            </Link>
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-[10px] border px-3 py-1.5 text-xs transition-colors",
              filter === key
                ? "border-white/15 bg-white/10 text-white"
                : "border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/80"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {visible.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rg-empty"
          >
            <Inbox className="mb-4 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/60">Aucun élément ici</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {visible.map((m, index) => {
              const groups = listRpGroups().filter((g) =>
                m.groupIds.includes(g.id)
              );
              const meta = STATUS_META[m.status];
              const reads = m.reads ?? [];
              const votes = m.votes ?? [];
              return (
                <motion.article
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => setSelected(m)}
                  className="rg-card cursor-pointer p-5 transition-colors hover:border-white/15"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase",
                            meta.className
                          )}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-white/30">
                          {new Date(m.updatedAt).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <h2 className="truncate text-base font-medium text-white/90">
                        {m.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm text-white/45">
                        {m.descriptionText}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/35">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {m.duration}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {m.noGroup
                            ? "Aucun groupe"
                            : `${groups.length} groupe${groups.length > 1 ? "s" : ""}`}
                        </span>
                        {m.authorName ? <span>Par {m.authorName}</span> : null}
                      </div>
                      {reads.length > 0 ? (
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className="flex -space-x-2">
                            {reads.slice(0, 6).map((r) => (
                              <DiscordAvatar
                                key={r.userId}
                                name={r.displayName}
                                url={r.avatarUrl}
                                size={24}
                                className="ring-2 ring-[#0a0a0b]"
                                title={`${r.displayName} a lu`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-white/35">
                            {reads.length} lecture{reads.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      ) : null}
                      {mode === "VOTE" && votes.length > 0 ? (
                        <p className="mt-2 text-[11px] text-white/35">
                          Votes {votes.length}/{quorum} ·{" "}
                          {votes.filter((v) => v.decision === "approve").length}{" "}
                          pour ·{" "}
                          {votes.filter((v) => v.decision === "reject").length}{" "}
                          contre
                        </p>
                      ) : null}
                    </div>

                    <div
                      className="flex shrink-0 flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canPropose && m.status === "draft" ? (
                        <button
                          type="button"
                          onClick={() => sendDraft(m)}
                          className="rg-btn rg-btn-primary"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Envoyer
                        </button>
                      ) : null}
                      {(canPropose ||
                        m.status === "draft" ||
                        m.status === "rejected") && (
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 bg-[#0a0a0b]/75 backdrop-blur-md"
              onClick={() => setSelected(null)}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              className="rg-card relative z-10 flex max-h-[min(90dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
            >
              <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase",
                        STATUS_META[selected.status].className
                      )}
                    >
                      {STATUS_META[selected.status].label}
                    </span>
                    {selected.status === "pending_review" && seeChrono ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
                        <Timer className="h-3 w-3" />
                        {formatLive(elapsedMs)}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-2xl font-medium tracking-tight text-white/95">
                    {selected.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="relative flex-1 space-y-5 overflow-y-auto px-6 py-5"
              >
                <section>
                  <p className="mb-2 text-[11px] tracking-wide text-white/35 uppercase">
                    Description
                  </p>
                  <div
                    className="mission-prose rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/85"
                    dangerouslySetInnerHTML={{
                      __html: selected.descriptionHtml,
                    }}
                  />
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/35 uppercase">
                      <Clock className="h-3.5 w-3.5" /> Durée
                    </p>
                    <p className="text-sm text-white/90">{selected.duration}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/35 uppercase">
                      <Users className="h-3.5 w-3.5" /> Groupes
                    </p>
                    {selected.noGroup ? (
                      <p className="text-sm text-white/90">Aucun groupe</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {selectedGroups.map((g) => (
                          <li
                            key={g.id}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs"
                          >
                            {g.kind} · {g.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] text-white/35 uppercase">
                    <Eye className="h-3.5 w-3.5" /> Lectures
                  </p>
                  <ActorTraceStack
                    actors={selected.reads ?? []}
                    showChrono={seeChrono}
                    emptyLabel="Personne n’a encore lu"
                  />
                </section>

                {mode === "VOTE" ? (
                  <section className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] text-violet-200/70 uppercase">
                      <Scale className="h-3.5 w-3.5" /> Votes · quorum {quorum}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(selected.votes ?? []).map((v) => (
                        <div
                          key={v.userId}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pr-2.5 pl-1"
                          title={`${v.displayName} · ${v.decision}`}
                        >
                          <DiscordAvatar
                            name={v.displayName}
                            url={v.avatarUrl}
                            size={22}
                          />
                          <span className="text-[11px] text-white/70">
                            {v.displayName}
                          </span>
                          {v.decision === "approve" ? (
                            <ThumbsUp className="h-3 w-3 text-emerald-300" />
                          ) : (
                            <ThumbsDown className="h-3 w-3 text-rose-300" />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-white/40">
                      {
                        (selected.votes ?? []).filter(
                          (v) => v.decision === "approve"
                        ).length
                      }{" "}
                      pour ·{" "}
                      {
                        (selected.votes ?? []).filter(
                          (v) => v.decision === "reject"
                        ).length
                      }{" "}
                      contre
                    </p>
                  </section>
                ) : null}

                {selected.authorName ? (
                  <p className="text-xs text-white/35">
                    Auteur : {selected.authorName}
                  </p>
                ) : null}
                {selected.reviewedBy && selected.reviewedAt ? (
                  <p className="text-xs text-white/35">
                    Décision · {selected.reviewedBy} ·{" "}
                    {new Date(selected.reviewedAt).toLocaleString("fr-FR")}
                  </p>
                ) : null}
              </div>

              <div className="relative space-y-3 border-t border-white/[0.06] px-6 py-4">
                {canReview &&
                selected.status === "pending_review" &&
                mode === "READ" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!alreadyRead ? (
                      <button
                        type="button"
                        disabled={!reachedEnd}
                        onClick={onMarkRead}
                        className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 disabled:opacity-40"
                      >
                        <Eye className="h-4 w-4" />
                        {reachedEnd ? "Marquer comme lu" : "Lis jusqu’en bas…"}
                      </button>
                    ) : (
                      <>
                        <span className="mr-auto text-xs text-emerald-200/80">
                          Lu
                          {seeChrono
                            ? ` · ${formatReadDuration(
                                selected.reads?.find(
                                  (r) => r.userId === account.userId
                                )?.durationMs
                              )}`
                            : ""}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === selected.id}
                          onClick={() => decide(selected, "approved")}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-100"
                        >
                          <Check className="h-4 w-4" /> Valider
                        </button>
                        <button
                          type="button"
                          disabled={busyId === selected.id}
                          onClick={() => decide(selected, "rejected")}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100"
                        >
                          <X className="h-4 w-4" /> Refuser
                        </button>
                      </>
                    )}
                  </div>
                ) : null}

                {canReview &&
                selected.status === "pending_review" &&
                mode === "VOTE" ? (
                  <div className="space-y-2">
                    {myVote ? (
                      <p className="text-xs text-white/45">
                        Ton vote :{" "}
                        {myVote.decision === "approve" ? "pour" : "contre"}
                      </p>
                    ) : (
                      <>
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Motif si refus (obligatoire pour contre)"
                          className="rg-field"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === selected.id}
                            onClick={() => vote("approve")}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-100"
                          >
                            <ThumbsUp className="h-4 w-4" /> Pour
                          </button>
                          <button
                            type="button"
                            disabled={
                              busyId === selected.id || !rejectReason.trim()
                            }
                            onClick={() => vote("reject")}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100 disabled:opacity-40"
                          >
                            <ThumbsDown className="h-4 w-4" /> Contre
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canPropose && selected.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => sendDraft(selected)}
                      className="rg-btn rg-btn-primary"
                    >
                      <Send className="h-4 w-4" /> Envoyer au Référent
                    </button>
                  ) : null}
                  {(canPropose ||
                    selected.status === "draft" ||
                    selected.status === "rejected") && (
                    <button
                      type="button"
                      onClick={() => remove(selected.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rg-btn"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </StaffPageShell>
  );
}
