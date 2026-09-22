"use client";

import { useAccount } from "@/components/account-context";
import { useDashboardUser } from "@/components/layout/dashboard-user";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import {
  countOpenDevFeedback,
  createDevFeedback,
  listDevFeedback,
  listDevFeedbackForAuthor,
  setDevFeedbackStatus,
  type DevFeedback,
  type DevFeedbackKind,
  type DevFeedbackStatus,
} from "@/lib/dev-feedback";
import { canTriageDevFeedback } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Bug, Lightbulb } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STATUS_LABEL: Record<DevFeedbackStatus, string> = {
  OPEN: "Nouveau",
  SEEN: "Vu",
  DONE: "Traité",
};

export function DevFeedbackPanel() {
  const user = useDashboardUser();
  const { grade } = useAccount();
  const isDev = canTriageDevFeedback(grade);
  const [kind, setKind] = useState<DevFeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [page, setPage] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DevFeedback[]>([]);
  const [tab, setTab] = useState<"mine" | "inbox">(isDev ? "inbox" : "mine");

  useEffect(() => {
    const refresh = () => {
      setRows(
        isDev ? listDevFeedback() : listDevFeedbackForAuthor(user.id)
      );
    };
    refresh();
    window.addEventListener("refgm:dev-feedback-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("refgm:dev-feedback-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isDev, user.id]);

  const mine = useMemo(
    () => rows.filter((row) => row.authorId === user.id),
    [rows, user.id]
  );
  const inbox = rows;
  const openCount = countOpenDevFeedback();
  const visible = tab === "inbox" && isDev ? inbox : mine;

  async function submit() {
    setError(null);
    setSent(false);
    const created = await createDevFeedback({
      kind,
      title,
      body,
      page,
      authorId: user.id,
      authorName: user.name?.trim() || "Référent",
    });
    if (!created) {
      setError("Ajoute un titre et une description.");
      return;
    }
    setTitle("");
    setPage("");
    setBody("");
    setSent(true);
  }

  return (
    <StaffPageShell
      title="Signaler"
      description="Un bug ou une amélioration. Le développeur reçoit le message."
      showBack
    >
      <section className="rg-card space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKind("bug")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              kind === "bug"
                ? "border-rose-400/40 bg-rose-400/15 text-rose-100"
                : "border-white/10 text-white/50 hover:text-white"
            )}
          >
            <Bug className="h-3.5 w-3.5" />
            Bug
          </button>
          <button
            type="button"
            onClick={() => setKind("amelioration")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              kind === "amelioration"
                ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                : "border-white/10 text-white/50 hover:text-white"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Amélioration
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] tracking-wide text-white/35 uppercase">
            Titre
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rg-field"
            placeholder={
              kind === "bug"
                ? "Ex. La page Référents ne charge pas"
                : "Ex. Filtrer l’annuaire par grade"
            }
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] tracking-wide text-white/35 uppercase">
            Page (optionnel)
          </span>
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="rg-field"
            placeholder="Accueil, Tableaux, Grades…"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] tracking-wide text-white/35 uppercase">
            Description
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="rg-field resize-y min-h-[120px]"
            placeholder="Ce qui se passe, ce que tu attendais, comment le reproduire."
          />
        </label>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        {sent ? (
          <p className="text-xs text-emerald-300">
            Envoyé au développeur.
          </p>
        ) : null}
        <div className="flex justify-end">
          <button type="button" onClick={() => void submit()} className="rg-btn rg-btn-primary">
            Envoyer
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium",
              tab === "mine"
                ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                : "border-white/10 text-white/50 hover:text-white"
            )}
          >
            Mes signalements · {mine.length}
          </button>
          {isDev ? (
            <button
              type="button"
              onClick={() => setTab("inbox")}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium",
                tab === "inbox"
                  ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                  : "border-white/10 text-white/50 hover:text-white"
              )}
            >
              File développeur · {openCount} ouvert
              {openCount > 1 ? "s" : ""}
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="rg-empty py-10">
            <p className="text-sm text-white/50">
              {tab === "inbox"
                ? "Aucun signalement pour le moment."
                : "Tu n’as encore rien envoyé."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((row) => (
              <article key={row.id} className="rg-card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{row.title}</p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {row.kind === "bug" ? "Bug" : "Amélioration"}
                      {row.page ? ` · ${row.page}` : ""} · {row.authorName} ·{" "}
                      {new Date(row.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      row.status === "OPEN" && "bg-rose-400/15 text-rose-100",
                      row.status === "SEEN" && "bg-amber-400/15 text-amber-100",
                      row.status === "DONE" && "bg-emerald-400/15 text-emerald-100"
                    )}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">
                  {row.body}
                </p>
                {isDev && tab === "inbox" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["OPEN", "SEEN", "DONE"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setDevFeedbackStatus(row.id, status, user.id)
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          row.status === status
                            ? "border-white/25 text-white"
                            : "border-white/10 text-white/40 hover:text-white"
                        )}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </StaffPageShell>
  );
}
