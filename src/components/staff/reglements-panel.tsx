"use client";

import { useAccount } from "@/components/account-context";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { canEditReglements } from "@/lib/staff-access";
import {
  listRuleDocs,
  RULE_DOCS,
  saveRuleDoc,
  type RuleDoc,
} from "@/lib/staff-storage";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ReglementsPanel() {
  const { account, grade } = useAccount();
  const canEdit = canEditReglements(grade);
  const [docs, setDocs] = useState<RuleDoc[]>([]);
  const [slug, setSlug] = useState(RULE_DOCS[0]!.slug);
  const [draft, setDraft] = useState("");

  function refresh() {
    const list = listRuleDocs();
    setDocs(list);
    const current = list.find((d) => d.slug === slug) ?? list[0];
    if (current) {
      setSlug(current.slug);
      setDraft(current.content);
    }
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("refgm:staff-updated", onUpdate);
    return () => window.removeEventListener("refgm:staff-updated", onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = docs.find((d) => d.slug === slug);
    if (current) setDraft(current.content);
  }, [slug, docs]);

  function save() {
    saveRuleDoc({
      slug,
      content: draft,
      updatedBy: account.displayName,
    });
    refresh();
  }

  return (
    <StaffPageShell
      title="Règlements"
      description="Docs GM / référents, édition selon les droits"
    >
      <div className="flex flex-wrap gap-2">
        {RULE_DOCS.map((doc) => (
          <button
            key={doc.slug}
            type="button"
            onClick={() => setSlug(doc.slug)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs",
              slug === doc.slug
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 text-white/40"
            )}
          >
            {doc.title}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white/90">
            {RULE_DOCS.find((d) => d.slug === slug)?.title}
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={save}
              className="rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100"
            >
              Enregistrer
            </button>
          ) : null}
        </div>
        {canEdit ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[420px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-mono text-sm outline-none"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/55">
            {draft}
          </pre>
        )}
      </section>
    </StaffPageShell>
  );
}
