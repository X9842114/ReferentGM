"use client";

import { MissionDescriptionEditor } from "@/components/mission-description-editor";
import { MissionIdeasButton } from "@/components/mission-ideas-fab";
import { MissionSubmitOverlay } from "@/components/mission-submit-overlay";
import { useAccount } from "@/components/account-context";
import { findGmCellForUser } from "@/lib/gm-cells";
import { saveMission } from "@/lib/mission-storage";
import { notifyReferentStaff } from "@/lib/notifications";
import { OrIcon } from "@/components/or-icon";
import { estimateOrFromDuration, orColorForKind, orColorLabel } from "@/lib/or-rewards";
import { canGiveRewards } from "@/lib/permissions";
import { GroupKindMark, GroupKindTabs } from "@/components/group-kind-tabs";
import {
  GROUP_KIND_CHIP,
  type GroupKind,
  type RpGroupOption,
} from "@/lib/rp-groups";
import { useRpGroups } from "@/hooks/use-rp-groups";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  FileText,
  RotateCcw,
  Search,
  Send,
  Type,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Step =
  | "greet"
  | "title"
  | "description"
  | "duration"
  | "groups"
  | "done";

type MissionDraft = {
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  duration: string;
  groupIds: string[];
  noGroup: boolean;
  sentForReview: boolean | null;
};

const STEPS_ORDER = ["title", "description", "duration", "groups"] as const;

const STEP_META: Record<
  (typeof STEPS_ORDER)[number],
  { label: string; hint: string; placeholder: string; icon: ReactNode }
> = {
  title: {
    label: "Titre de la mission",
    hint: "Donne un titre clair et percutant",
    placeholder: "Ex. Braquage fleeca, équipe de 4",
    icon: <Type className="h-4 w-4" />,
  },
  description: {
    label: "Description de la mission",
    hint: "Mise en forme : gras, couleurs, listes…",
    placeholder: "Contexte, objectifs, règles RP…",
    icon: <FileText className="h-4 w-4" />,
  },
  duration: {
    label: "Temps de la mission",
    hint: "Indique la durée estimée",
    placeholder: "Ex. 45 minutes / 1h30",
    icon: <Clock className="h-4 w-4" />,
  },
  groups: {
    label: "Groupes concernés",
    hint: "Sélectionne un ou plusieurs groupes, ou aucun",
    placeholder: "Rechercher un groupe…",
    icon: <Users className="h-4 w-4" />,
  },
};

function useAutoResizeTextarea(minHeight: number, maxHeight = 220) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const el = textareaRef.current;
      if (!el) return;
      if (reset) {
        el.style.height = `${minHeight}px`;
        return;
      }
      el.style.height = `${minHeight}px`;
      el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (el) el.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

export function MissionProposeFlow({
  userName,
}: {
  userName?: string | null;
}) {
  const { account, grade } = useAccount();
  const allowOr = canGiveRewards(grade);
  const firstName = (userName?.trim().split(/\s+/)[0] || "toi").replace(
    /,$/,
    ""
  );
  const catalog = useRpGroups();
  const [step, setStep] = useState<Step>("title");
  const [draft, setDraft] = useState<MissionDraft>({
    title: "",
    descriptionHtml: "",
    descriptionText: "",
    duration: "",
    groupIds: [],
    noGroup: false,
    sentForReview: null,
  });
  const [value, setValue] = useState("");
  const [descHtml, setDescHtml] = useState("");
  const [descText, setDescText] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupTab, setGroupTab] = useState<GroupKind | "ALL">("ALL");
  const [submitOutcome, setSubmitOutcome] = useState<"send" | "draft" | null>(
    null
  );
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(60);

  useEffect(() => {
    if (step === "title") {
      setValue(draft.title);
      window.setTimeout(() => {
        adjustHeight();
        textareaRef.current?.focus();
      }, 80);
    }
    if (step === "duration") {
      setValue(draft.duration);
      window.setTimeout(() => {
        adjustHeight();
        textareaRef.current?.focus();
      }, 80);
    }
    if (step === "description") {
      setDescHtml(draft.descriptionHtml);
      setDescText(draft.descriptionText);
    }
    if (step === "groups") {
      setGroupQuery("");
    }
    // Intentionally only when step changes — restore saved draft values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((g) => groupTab === "ALL" || g.kind === groupTab)
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.id.includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .slice(0, 8);
  }, [catalog, groupQuery, groupTab]);

  const selectedGroups = useMemo(
    () => catalog.filter((g) => draft.groupIds.includes(g.id)),
    [catalog, draft.groupIds]
  );

  function canGoNext() {
    if (step === "title" || step === "duration") return Boolean(value.trim());
    if (step === "description")
      return Boolean(descText.trim()) && !isEmptyHtml(descHtml);
    if (step === "groups") return draft.noGroup || draft.groupIds.length > 0;
    return false;
  }

  function persistCurrentStep() {
    if (step === "title") {
      setDraft((prev) => ({ ...prev, title: value.trim() || prev.title }));
    } else if (step === "description") {
      setDraft((prev) => ({
        ...prev,
        descriptionHtml: descHtml || prev.descriptionHtml,
        descriptionText: descText.trim() || prev.descriptionText,
      }));
    } else if (step === "duration") {
      setDraft((prev) => ({
        ...prev,
        duration: value.trim() || prev.duration,
      }));
    }
  }

  function goBack() {
    const prevStep =
      step === "description"
        ? "title"
        : step === "duration"
          ? "description"
          : step === "groups"
            ? "duration"
            : step === "done"
              ? "groups"
              : null;
    if (!prevStep) return;

    persistCurrentStep();
    if (step === "done") {
      setDraft((prev) => ({ ...prev, sentForReview: null }));
      setSubmitOutcome(null);
    }
    setStep(prevStep);
  }

  function goNext() {
    if (!canGoNext()) return;

    if (step === "title") {
      setDraft((prev) => ({ ...prev, title: value.trim() }));
      setStep("description");
      return;
    }
    if (step === "description") {
      setDraft((prev) => ({
        ...prev,
        descriptionHtml: descHtml,
        descriptionText: descText.trim(),
      }));
      setStep("duration");
      return;
    }
    if (step === "duration") {
      setDraft((prev) => ({ ...prev, duration: value.trim() }));
      setStep("groups");
      return;
    }
    if (step === "groups") {
      setStep("done");
    }
  }

  function toggleGroup(group: RpGroupOption) {
    setDraft((prev) => {
      const exists = prev.groupIds.includes(group.id);
      return {
        ...prev,
        noGroup: false,
        groupIds: exists
          ? prev.groupIds.filter((id) => id !== group.id)
          : [...prev.groupIds, group.id],
      };
    });
  }

  function selectNoGroup() {
    setDraft((prev) => ({
      ...prev,
      noGroup: true,
      groupIds: [],
    }));
  }

  function restart() {
    setDraft({
      title: "",
      descriptionHtml: "",
      descriptionText: "",
      duration: "",
      groupIds: [],
      noGroup: false,
      sentForReview: null,
    });
    setValue("");
    setDescHtml("");
    setDescText("");
    setGroupQuery("");
    setSubmitOutcome(null);
    setStep("title");
  }

  function sendToReferent(send: boolean) {
    if (submitOutcome) return;
    setSubmitOutcome(send ? "send" : "draft");
    const cell = findGmCellForUser(account.userId);
    const created = saveMission({
      title: draft.title,
      descriptionHtml: draft.descriptionHtml,
      descriptionText: draft.descriptionText,
      duration: draft.duration,
      groupIds: draft.groupIds,
      noGroup: draft.noGroup,
      status: send ? "pending_review" : "draft",
      authorName: cell?.groupName
        ? `${cell.groupName}`
        : account.displayName || userName || null,
      authorId: account.userId,
      authorGroupId: cell?.id ?? null,
      authorGroupName: cell?.groupName ?? null,
      reads: [],
      votes: [],
      orRewards: allowOr ? undefined : [],
    });
    if (send) {
      void notifyReferentStaff({
        type: "mission.pending",
        title: "Nouvelle mission à traiter",
        body: `${created.title} · ${created.authorName || "GM"}`,
        href: "/dashboard",
        excludeUserId: account.userId,
      });
    }
  }

  const onSubmitAnimationComplete = useCallback((outcome: "send" | "draft") => {
    setDraft((prev) => ({
      ...prev,
      sentForReview: outcome === "send",
    }));
    setSubmitOutcome(null);
  }, []);

  const headline =
    step === "greet"
      ? `Bonjour ${firstName}`
      : step === "title"
        ? "Titre de la mission"
        : step === "description"
          ? "Description de la mission"
          : step === "duration"
            ? "Temps de la mission"
            : step === "groups"
              ? "Groupes de la mission"
              : "Mission prête";

  const subtitle =
    step === "greet"
      ? "Préparation d’une nouvelle mission…"
      : step === "done"
        ? draft.sentForReview === null
          ? "Veux-tu l’envoyer au Référent GameMaster pour validation ?"
          : draft.sentForReview
            ? "Mission envoyée aux Référents GameMaster"
            : "Mission enregistrée sans envoi"
        : STEP_META[step as keyof typeof STEP_META]?.hint;

  const stepIndex = {
    greet: -1,
    title: 0,
    description: 1,
    duration: 2,
    groups: 3,
    done: 4,
  }[step];

  return (
    <div className="lab-bg relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-transparent p-6 text-white">
      <MissionSubmitOverlay
        outcome={submitOutcome}
        onComplete={onSubmitAnimationComplete}
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <motion.p
            className="inline-flex rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-400"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            RefGM
          </motion.p>
          <AnimatePresence mode="wait">
            <motion.h1
              key={headline}
              className="pb-1 text-3xl font-semibold tracking-tight text-white sm:text-5xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              {headline}
            </motion.h1>
          </AnimatePresence>
          <div className="mx-auto h-px w-full max-w-[220px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <AnimatePresence mode="wait">
            <motion.p
              key={String(subtitle)}
              className="text-sm text-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {subtitle}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {STEPS_ORDER.map((s, i) => {
            const done = stepIndex > i || step === "done";
            const current = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors",
                    done || current
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/10 text-white/30"
                  )}
                  title={STEP_META[s].label}
                >
                  {done && !current ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < STEPS_ORDER.length - 1 ? (
                  <div
                    className={cn(
                      "h-px w-5 sm:w-8",
                      stepIndex > i ? "bg-white/30" : "bg-white/10"
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {step === "done" ? (
            <motion.div
              key="done"
              className="rg-card-glass space-y-6 p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="space-y-4 text-sm">
                <SummaryRow
                  icon={<Type className="h-4 w-4" />}
                  label="Titre"
                  value={draft.title}
                />
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] tracking-wide text-white/40 uppercase">
                    <FileText className="h-4 w-4" />
                    Description
                  </div>
                  <div
                    className="mission-prose text-white/85"
                    dangerouslySetInnerHTML={{ __html: draft.descriptionHtml }}
                  />
                </div>
                <SummaryRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Durée"
                  value={draft.duration}
                />
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] tracking-wide text-white/40 uppercase">
                    <Users className="h-4 w-4" />
                    Groupes
                  </div>
                  {draft.noGroup ? (
                    <p className="text-white/85">Aucun groupe</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {selectedGroups.map((g) => {
                        const color = orColorForKind(g.kind);
                        const amount = estimateOrFromDuration(draft.duration);
                        return (
                          <li
                            key={g.id}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/80"
                          >
                            <span className="text-white/40">{g.kind}</span> ·{" "}
                            {g.name}
                            {allowOr ? (
                              <>
                                {" "}
                                <span
                                  className={
                                    color === "bleu"
                                      ? "inline-flex items-center gap-1 text-violet-300"
                                      : "inline-flex items-center gap-1 text-rose-300"
                                  }
                                >
                                  <OrIcon color={color} size={14} />+{amount}{" "}
                                  {orColorLabel(color)}
                                </span>
                              </>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {draft.sentForReview === null ? (
                <motion.div
                  className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-sm text-white/80">
                    Envoyer cette mission au{" "}
                    <span className="font-medium text-white">
                      Référent GameMaster
                    </span>{" "}
                    pour validation ?
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendToReferent(true)}
                      disabled={!!submitOutcome}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#0a0a0b] transition-colors hover:bg-white/90 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      Oui, envoyer pour validation
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendToReferent(false)}
                      disabled={!!submitOutcome}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
                    >
                      Non, garder en brouillon
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "space-y-3 rounded-xl border px-4 py-4 text-sm",
                    draft.sentForReview
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90"
                      : "border-amber-400/25 bg-amber-500/10 text-amber-50/90"
                  )}
                >
                  <p>
                    {draft.sentForReview
                      ? "La mission a été proposée aux Référents GameMaster. Elle reste en attente de validation."
                      : "Mission enregistrée. Tu pourras l’envoyer plus tard."}
                  </p>
                </motion.div>
              )}

              <button
                type="button"
                onClick={goBack}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Modifier la mission
              </button>

              <button
                type="button"
                onClick={restart}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Nouvelle mission
              </button>
            </motion.div>
          ) : step === "groups" ? (
            <motion.div
              key="groups"
              className="rg-card-glass overflow-hidden"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3 text-xs text-white/45">
                {STEP_META.groups.icon}
                <span>{STEP_META.groups.label}</span>
              </div>

              <div className="space-y-3 p-4">
                <button
                  type="button"
                  onClick={selectNoGroup}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors",
                    draft.noGroup
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                  )}
                >
                  <span>Aucun groupe</span>
                  {draft.noGroup ? <Check className="h-4 w-4" /> : null}
                </button>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={groupQuery}
                    onChange={(e) => setGroupQuery(e.target.value)}
                    placeholder={STEP_META.groups.placeholder}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-2.5 pr-3 pl-12 text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <GroupKindTabs value={groupTab} onChange={setGroupTab} />
                </div>

                {selectedGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
                          GROUP_KIND_CHIP[g.kind]
                        )}
                      >
                        {g.name}
                        <X className="h-3 w-3 opacity-70" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {filteredGroups.map((g) => {
                    const active = draft.groupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/[0.05]"
                        )}
                      >
                          <span className="min-w-0 truncate">
                            <GroupKindMark kind={g.kind} />{" "}
                            {g.name}
                          </span>
                        <span className="ml-3 shrink-0 text-[11px] text-white/30">
                          #{g.id.replace(/-.*$/, "")}
                          {active ? (
                            <Check className="ml-2 inline h-3.5 w-3.5 text-white/80" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  {groupQuery.trim().length < 2 ? (
                    <p className="px-2 py-6 text-center text-xs text-white/35">
                      Tape au moins 2 lettres. Toute la liste est dans Groupes.
                    </p>
                  ) : filteredGroups.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-white/35">
                      Aucun groupe trouvé
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] p-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext()}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                    canGoNext()
                      ? "bg-white text-[#0a0a0b] shadow-lg shadow-white/10"
                      : "bg-white/[0.05] text-white/35"
                  )}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              className="rg-card-glass overflow-hidden"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3 text-xs text-white/45">
                {STEP_META[step as keyof typeof STEP_META].icon}
                <span>{STEP_META[step as keyof typeof STEP_META].label}</span>
              </div>

              <div className="p-4">
                {step === "description" ? (
                  <MissionDescriptionEditor
                    value={descHtml}
                    onChange={(html, plain) => {
                      setDescHtml(html);
                      setDescText(plain);
                    }}
                    placeholder={STEP_META.description.placeholder}
                    toolbarExtra={
                      <MissionIdeasButton
                        compact
                        onPick={(idea) => {
                          setDraft((prev) => ({
                            ...prev,
                            title: prev.title || idea.title,
                            descriptionText: idea.summary,
                            descriptionHtml: `<p>${idea.summary}</p>`,
                            duration:
                              idea.duration.split("–")[0]?.trim() ||
                              prev.duration,
                          }));
                          setDescHtml(`<p>${idea.summary}</p>`);
                          setDescText(idea.summary);
                          if (!draft.title) setValue(idea.title);
                        }}
                      />
                    }
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      adjustHeight();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        goNext();
                      }
                    }}
                    placeholder={
                      STEP_META[step as keyof typeof STEP_META].placeholder
                    }
                    className={cn(
                      "w-full resize-none bg-transparent px-2 py-2 text-sm text-white/90",
                      "min-h-[60px] placeholder:text-white/25 focus:outline-none"
                    )}
                    style={{ overflow: "hidden" }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] p-4">
                {step === "title" ? (
                  <p className="text-[11px] text-white/30">
                    Première étape du parcours
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext()}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                    canGoNext()
                      ? "bg-white text-[#0a0a0b] shadow-lg shadow-white/10"
                      : "bg-white/[0.05] text-white/35"
                  )}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] tracking-wide text-white/40 uppercase">
        {icon}
        {label}
      </div>
      <p className="whitespace-pre-wrap text-white/85">{value}</p>
    </div>
  );
}
