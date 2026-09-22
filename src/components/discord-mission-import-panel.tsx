"use client";

import { useDashboardUser } from "@/components/layout/dashboard-user";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { GROUP_KIND_LABEL } from "@/lib/rp-groups";
import {
  buildSuiviMessage,
  deleteCataloguedDiscordMission,
  isMissionRewarded,
  listCataloguedDiscordMissions,
  recordMissionFollowUp,
  saveCataloguedDiscordMission,
  suggestedGrants,
  type CataloguedDiscordMission,
} from "@/lib/discord-mission-catalog";
import {
  isUsefulDiscordParse,
  parseDiscordMissionPaste,
} from "@/lib/discord-mission-parse";
import { orColorLabel } from "@/lib/or-rewards";
import { cn } from "@/lib/utils";
import {
  Check,
  ClipboardPaste,
  Copy,
  Gift,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function DiscordMissionImportPanel() {
  const user = useDashboardUser();
  const [rows, setRows] = useState<CataloguedDiscordMission[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const parsed = useMemo(() => parseDiscordMissionPaste(draft), [draft]);
  const canPublish = isUsefulDiscordParse(parsed);
  const referentName = user.name?.trim() || "Référent";

  useEffect(() => {
    const refresh = () => setRows(listCataloguedDiscordMissions());
    refresh();
    window.addEventListener("refgm:discord-missions-updated", refresh);
    return () =>
      window.removeEventListener("refgm:discord-missions-updated", refresh);
  }, []);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function publish(raw: string) {
    const parsedNow = parseDiscordMissionPaste(raw);
    const created = saveCataloguedDiscordMission({
      raw,
      parsed: parsedNow,
      importedBy: user.id,
      importedByName: referentName,
    });
    if (!created) {
      setDraft(raw);
      setError("Il manque le nom ou la description. Corrige et publie.");
      return false;
    }
    setDraft("");
    setError(null);
    flash("Mission publiée. Les autres référents la voient.");
    return true;
  }

  async function pasteAndPublish() {
    setBusy(true);
    setError(null);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setError("Rien dans le presse-papiers. Copie d’abord le message Discord.");
        return;
      }
      if (!isUsefulDiscordParse(parseDiscordMissionPaste(text))) {
        setDraft(text);
        setError("Presque : complète le nom ou la description, puis publie.");
        return;
      }
      publish(text);
    } catch {
      setError("Colle avec Ctrl+V dans le cadre, ou autorise le presse-papiers.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = rows.filter((row) => !isMissionRewarded(row));
  const done = rows.filter((row) => isMissionRewarded(row));
  const visible = showDone ? [...waiting, ...done] : waiting;
  const active = rows.find((row) => row.id === activeId) ?? null;
  const grants = active ? suggestedGrants(active) : [];
  const suivi = active
    ? active.followUp?.suiviMessage ||
      buildSuiviMessage({
        title: active.title,
        duration: active.duration,
        rewards: active.rewards,
        gmNames: active.gmNames,
        referentName,
        grants: active.followUp?.grants?.length ? active.followUp.grants : grants,
      })
    : "";

  async function copySuiviAndClose(markDone: boolean) {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(suivi);
      setCopied(true);
    } catch {
      setError("Copie bloquée par le navigateur. Sélectionne le texte à la main.");
    }
    if (markDone) {
      recordMissionFollowUp({
        id: active.id,
        rewardedBy: user.id,
        rewardedByName: referentName,
        grants: active.followUp?.grants?.length ? active.followUp.grants : grants,
        suiviMessage: suivi,
      });
      flash("Suivi copié. Mission marquée comme récompensée.");
      setActiveId(null);
      setCopied(false);
    } else {
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <StaffPageShell
      title="Missions"
      description="Deux gestes : coller le Discord, puis après le give Or copier le suivi."
    >
      <section className="rg-card space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">1. Nouvelle mission</p>
            <p className="mt-1 text-sm text-white/40">
              Copie le message sur Discord, puis un clic ici.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void pasteAndPublish()}
            className="rg-btn rg-btn-primary px-4 py-2.5"
          >
            <ClipboardPaste className="h-4 w-4" />
            Coller et publier
          </button>
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (!text) return;
            e.preventDefault();
            if (isUsefulDiscordParse(parseDiscordMissionPaste(text))) {
              publish(text);
              return;
            }
            setDraft(text);
            setError("Presque : complète le nom ou la description, puis publie.");
          }}
          rows={draft || error ? 8 : 3}
          className="rg-field resize-y font-mono text-[13px] leading-relaxed"
          placeholder="Ou colle ici avec Ctrl+V, ça publie tout seul si le message est complet."
        />

        {draft && canPublish ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/55">
              {parsed.title || "Sans titre"}
              {parsed.groups.length
                ? ` · ${parsed.groups.map((g) => g.name).join(", ")}`
                : ""}
            </p>
            <button
              type="button"
              onClick={() => publish(draft)}
              className="rg-btn rg-btn-primary px-4 py-2"
            >
              Publier
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {toast ? <p className="text-sm text-emerald-300">{toast}</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">2. Après le give Or</p>
            <p className="mt-1 text-sm text-white/40">
              {waiting.length === 0
                ? "Rien en attente."
                : `${waiting.length} mission${waiting.length > 1 ? "s" : ""} sans suivi.`}
            </p>
          </div>
          {done.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="text-xs text-white/40 hover:text-white/70"
            >
              {showDone ? "Masquer l’historique" : `Historique (${done.length})`}
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="rg-empty">
            <p className="text-sm text-white/50">
              Colle un message Discord pour que tout le monde le voie.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((row) => {
              const rewarded = isMissionRewarded(row);
              return (
                <article key={row.id} className="rg-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white">
                        {row.title || "Sans titre"}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {row.importedByName}
                        {row.duration ? ` · ${row.duration}` : ""}
                        {rewarded && row.followUp
                          ? ` · suivi par ${row.followUp.rewardedByName}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCataloguedDiscordMission(row.id)}
                      className="rounded-full p-1.5 text-white/25 hover:bg-white/5 hover:text-rose-200"
                      title="Retirer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {row.description ? (
                    <p className="line-clamp-3 text-sm leading-relaxed text-white/55">
                      {row.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {row.groups.map((group) => (
                      <span
                        key={group.id}
                        className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-[11px] text-violet-100"
                      >
                        {group.name} · {GROUP_KIND_LABEL[group.kind]}
                      </span>
                    ))}
                    {row.gmNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-[11px] text-violet-100"
                      >
                        GM {name}
                      </span>
                    ))}
                  </div>
                  {!rewarded ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCopied(false);
                        setActiveId(row.id);
                      }}
                      className="rg-btn rg-btn-primary w-full justify-center sm:w-auto"
                    >
                      <Gift className="h-4 w-4" />
                      J’ai donné les récompenses
                    </button>
                  ) : (
                    <p className="text-xs text-emerald-200/80">Suivi déjà fait</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="rg-card w-full max-w-lg space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/40">Suivi missions</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {active.title || "Sans titre"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-full p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-white/50">
              Copie ce texte dans le salon suivi, une fois l’Or donné au groupe.
            </p>
            {grants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {grants.map((g) => (
                  <span
                    key={g.groupId}
                    className="rounded-full bg-emerald-400/12 px-2.5 py-0.5 text-[11px] text-emerald-100"
                  >
                    {g.groupName} · {g.amount} {orColorLabel(g.color)}
                  </span>
                ))}
              </div>
            ) : null}
            <pre className="max-h-56 overflow-auto rounded-2xl bg-black/40 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-white/80">
              {suivi}
            </pre>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void copySuiviAndClose(true)}
                className="rg-btn rg-btn-primary flex-1 justify-center py-2.5"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copier le suivi et c’est fait
              </button>
            </div>
            <button
              type="button"
              onClick={() => void copySuiviAndClose(false)}
              className="w-full text-center text-xs text-white/35 hover:text-white/60"
            >
              Copier sans marquer comme fait
            </button>
          </div>
        </div>
      ) : null}
    </StaffPageShell>
  );
}
