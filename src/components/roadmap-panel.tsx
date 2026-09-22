"use client";

import { EmptyHint } from "@/components/empty-hint";
import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { MetallicButton } from "@/components/ui/metallic-button";
import { canAccessReferentHq, isDeveloper } from "@/lib/permissions";
import {
  deleteRoadmapEntry,
  ensureRoadmapSeed,
  listRoadmap,
  ROADMAP_KIND_LABEL,
  ROADMAP_KIND_ORDER,
  roadmapVoteCounts,
  saveRoadmapEntry,
  voteRoadmapEntry,
  type RoadmapEntry,
  type RoadmapKind,
  type RoadmapVoteChoice,
} from "@/lib/product-roadmap";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const KIND_DOT: Record<RoadmapKind, string> = {
  upcoming: "bg-violet-300",
  wip: "bg-amber-300",
  patch: "bg-emerald-300",
};

export function RoadmapPanel() {
  const { account, grade } = useAccount();
  const canEdit = isDeveloper(grade);
  const canVote = canAccessReferentHq(grade);
  const [rows, setRows] = useState<RoadmapEntry[]>([]);
  const [filter, setFilter] = useState<"all" | RoadmapKind>("all");
  const [kind, setKind] = useState<RoadmapKind>("upcoming");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [progress, setProgress] = useState(20);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      ensureRoadmapSeed();
      setRows(listRoadmap());
      setReady(true);
    };
    refresh();
    window.addEventListener("refgm:roadmap-updated", refresh);
    return () => window.removeEventListener("refgm:roadmap-updated", refresh);
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.kind === filter)),
    [filter, rows]
  );

  const openVotes = rows.filter((row) => row.kind === "upcoming").length;

  function submit() {
    const saved = saveRoadmapEntry({
      kind,
      title,
      body,
      progress: kind === "patch" ? 100 : kind === "upcoming" ? 0 : progress,
      authorId: account.userId,
      authorName: account.displayName,
    });
    if (!saved) return;
    setTitle("");
    setBody("");
    setProgress(20);
    setKind("upcoming");
    setRows(listRoadmap());
  }

  function vote(id: string, choice: RoadmapVoteChoice) {
    voteRoadmapEntry(
      id,
      { userId: account.userId, userName: account.displayName },
      choice
    );
    setRows(listRoadmap());
  }

  return (
    <StaffPageShell
      title="Avancement"
      description="Le développeur propose, les référents votent, puis ça avance sur la timeline."
      className="max-w-3xl"
      ready={ready}
    >
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `Tout (${rows.length})`],
            ["upcoming", `À voter (${openVotes})`],
            ["wip", ROADMAP_KIND_LABEL.wip],
            ["patch", ROADMAP_KIND_LABEL.patch],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs",
              filter === id
                ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                : "border-white/10 text-white/40"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {canEdit ? (
        <form
          className="rg-card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-sm font-semibold text-white">
            Proposer aux référents
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ROADMAP_KIND_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px]",
                  kind === id
                    ? "bg-white text-[#0a0a0b]"
                    : "text-white/45 hover:text-white"
                )}
              >
                {id === "upcoming" ? "Proposition" : ROADMAP_KIND_LABEL[id]}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la proposition"
            className="rg-field"
            required
          />
          {kind === "wip" ? (
            <label className="block space-y-1.5">
              <span className="text-[11px] text-white/40">
                Avancement {progress}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-violet-400"
              />
            </label>
          ) : null}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Pourquoi c’est utile, ce que ça change…"
            rows={3}
            className="rg-field resize-y"
          />
          <MetallicButton
            type="submit"
            label={kind === "upcoming" ? "Envoyer au vote" : "Publier"}
          />
        </form>
      ) : null}

      {visible.length === 0 ? (
        <EmptyHint
          icon={<ThumbsUp className="h-7 w-7" />}
          title="Rien sur la timeline"
          hint={
            canEdit
              ? "Propose une idée : les référents pourront voter pour ou contre."
              : "Dès qu’une proposition est publiée, tu pourras voter ici."
          }
        />
      ) : (
        <ol className="relative ml-2 border-l border-white/10 pl-6">
          {visible.map((row, index) => (
            <TimelineItem
              key={row.id}
              row={row}
              index={index}
              canEdit={canEdit}
              canVote={canVote}
              userId={account.userId}
              onVote={vote}
              onDelete={(id) => {
                deleteRoadmapEntry(id);
                setRows(listRoadmap());
              }}
              onProgress={(id, next) => {
                saveRoadmapEntry({
                  id,
                  kind: row.kind,
                  title: row.title,
                  body: row.body,
                  version: row.version,
                  progress: next,
                });
                setRows(listRoadmap());
              }}
              onKind={(id, nextKind) => {
                saveRoadmapEntry({
                  id,
                  kind: nextKind,
                  title: row.title,
                  body: row.body,
                  version: row.version,
                  progress:
                    nextKind === "patch"
                      ? 100
                      : nextKind === "upcoming"
                        ? 0
                        : Math.max(row.progress, 10),
                });
                setRows(listRoadmap());
              }}
            />
          ))}
        </ol>
      )}
    </StaffPageShell>
  );
}

function TimelineItem({
  row,
  index,
  canEdit,
  canVote,
  userId,
  onVote,
  onDelete,
  onProgress,
  onKind,
}: {
  row: RoadmapEntry;
  index: number;
  canEdit: boolean;
  canVote: boolean;
  userId: string;
  onVote: (id: string, choice: RoadmapVoteChoice) => void;
  onDelete: (id: string) => void;
  onProgress: (id: string, progress: number) => void;
  onKind: (id: string, kind: RoadmapKind) => void;
}) {
  const counts = roadmapVoteCounts(row);
  const mine = row.votes.find((vote) => vote.userId === userId)?.choice;
  const showVotes = row.kind === "upcoming" || counts.total > 0;

  return (
    <motion.li
      className="relative pb-8 last:pb-0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
    >
      <span
        className={cn(
          "absolute top-5 -left-[1.64rem] h-3 w-3 rounded-full ring-4 ring-[#030304]",
          KIND_DOT[row.kind]
        )}
      />
      <article className="rg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-white/40">
              {ROADMAP_KIND_LABEL[row.kind]}
              {row.authorName ? ` · ${row.authorName}` : ""}
              {" · "}
              {new Date(row.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              {row.title}
            </h2>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="text-white/25 hover:text-rose-200"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {row.body ? (
          <p className="mt-2 text-sm leading-relaxed text-white/55">{row.body}</p>
        ) : null}

        {row.kind === "wip" ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-white/40">
              <span>Avancement</span>
              <span>{row.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300"
                style={{ width: `${row.progress}%` }}
              />
            </div>
            {canEdit ? (
              <input
                type="range"
                min={0}
                max={100}
                value={row.progress}
                className="mt-2 w-full accent-violet-400"
                onChange={(e) => onProgress(row.id, Number(e.target.value))}
              />
            ) : null}
          </div>
        ) : null}

        {showVotes ? (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] text-white/40">
              Est-ce que ça serait bien ?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canVote}
                onClick={() => onVote(row.id, "yes")}
                className={cn(
                  "rg-btn",
                  mine === "yes" && "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Pour · {counts.yes}
              </button>
              <button
                type="button"
                disabled={!canVote}
                onClick={() => onVote(row.id, "no")}
                className={cn(
                  "rg-btn",
                  mine === "no" && "border-rose-400/40 bg-rose-500/15 text-rose-100"
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Contre · {counts.no}
              </button>
            </div>
            {mine ? (
              <p className="flex items-center gap-1 text-[11px] text-white/35">
                <Check className="h-3 w-3" />
                Ton vote est enregistré
              </p>
            ) : null}
          </div>
        ) : null}

        {canEdit && row.kind !== "patch" ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.kind === "upcoming" ? (
              <button
                type="button"
                className="rg-btn text-[11px]"
                onClick={() => onKind(row.id, "wip")}
              >
                Passer en cours
              </button>
            ) : null}
            <button
              type="button"
              className="rg-btn text-[11px]"
              onClick={() => onKind(row.id, "patch")}
            >
              Marquer livré
            </button>
          </div>
        ) : null}
      </article>
    </motion.li>
  );
}
