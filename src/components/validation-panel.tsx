"use client";

import { useAccount } from "@/components/account-context";
import { DiscordAvatar } from "@/components/actor-trace";
import { ValidationSuccessOverlay } from "@/components/account-status-screens";
import {
  listPendingAccounts,
  reviewAccount,
  type RefgmAccount,
} from "@/lib/accounts";
import { DEFAULT_GRADE, type GradeId } from "@/lib/grades";
import {
  assignableGradesFor,
  getGradeLabel,
} from "@/lib/permissions";
import { StaffPageShell } from "@/components/staff/staff-page-shell";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Inbox, Search, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ValidationPanelProps = {
  reviewerId: string;
};

export function ValidationPanel({ reviewerId }: ValidationPanelProps) {
  const { grade: actorGrade } = useAccount();
  const [pending, setPending] = useState<RefgmAccount[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeByUser, setGradeByUser] = useState<Record<string, GradeId>>({});
  const [success, setSuccess] = useState<{
    displayName: string;
    gradeLabel: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignable = assignableGradesFor(actorGrade);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  async function refresh() {
    const list = await listPendingAccounts();
    setPending(list);
    setLoading(false);
  }

  useEffect(() => {
    const load = () => {
      void listPendingAccounts().then((list) => {
        setPending(list);
        setLoading(false);
        setGradeByUser((prev) => {
          const next = { ...prev };
          for (const u of list) {
            if (!next[u.userId]) next[u.userId] = DEFAULT_GRADE;
          }
          return next;
        });
      });
    };
    load();
    const t = window.setInterval(load, 15000);
    window.addEventListener("refgm:accounts-updated", load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("refgm:accounts-updated", load);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pending;
    return pending.filter(
      (u) =>
        u.displayName.toLowerCase().includes(query) ||
        u.userId.includes(query)
    );
  }, [pending, q]);

  async function decide(
    target: RefgmAccount,
    decision: "APPROVED" | "REJECTED"
  ) {
    setBusyId(target.userId);
    setError(null);
    const grade =
      decision === "APPROVED"
        ? gradeByUser[target.userId] ?? DEFAULT_GRADE
        : undefined;
    const reviewed = await reviewAccount({
      targetUserId: target.userId,
      reviewerId,
      decision,
      grade,
    });
    await refresh();
    setBusyId(null);
    if (!reviewed || reviewed.status === "PENDING") {
      setError(
        "La validation n’a pas été enregistrée. Vérifie SUPABASE_SERVICE_ROLE_KEY sur Vercel, puis réessaie."
      );
      return;
    }
    if (decision === "APPROVED" && reviewed.status === "APPROVED") {
      setSuccess({
        displayName: target.displayName,
        gradeLabel: getGradeLabel(reviewed.grade),
        avatarUrl: target.discordAvatarUrl,
      });
    }
  }

  return (
    <>
      {success ? (
        <ValidationSuccessOverlay
          displayName={success.displayName}
          gradeLabel={success.gradeLabel}
          avatarUrl={success.avatarUrl}
          onClose={clearSuccess}
        />
      ) : null}
      <StaffPageShell
        title="Validation"
        description="Les nouvelles connexions Discord passent ici. Choisis le grade au moment d’approuver."
        backHref="/dashboard/administration"
        backLabel="Administration"
        className="max-w-3xl"
      >
          {error ? (
            <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un pseudo ou un ID…"
            className="rg-field rg-field-icon py-2.5 pr-3"
          />
        </div>

        {loading ? (
          <p className="text-sm text-[#8a8a93]">Chargement…</p>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rg-empty"
          >
            <Inbox className="mb-4 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/60">Aucun compte en attente</p>
            <p className="mt-1 text-xs text-white/35">
              Les nouvelles connexions Discord apparaîtront ici
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((user, index) => (
                <motion.div
                  key={user.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: index * 0.03 }}
                  className="rg-card flex flex-col gap-4 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DiscordAvatar
                      name={user.displayName}
                      url={user.discordAvatarUrl}
                      userId={user.userId}
                      size={48}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90">
                        {user.displayName}
                      </p>
                      <p className="truncate font-mono text-[11px] text-white/35">
                        {user.userId}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-200/80">
                        Demande le{" "}
                        {new Date(user.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex flex-1 flex-col gap-1 text-[11px] text-white/40">
                      Grade à l’approbation
                      <select
                        value={gradeByUser[user.userId] ?? DEFAULT_GRADE}
                        onChange={(e) =>
                          setGradeByUser((prev) => ({
                            ...prev,
                            [user.userId]: e.target.value as GradeId,
                          }))
                        }
                        className="rg-field text-xs"
                      >
                        {assignable.map((id) => (
                          <option key={id} value={id}>
                            {getGradeLabel(id)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busyId === user.userId}
                        onClick={() => void decide(user, "APPROVED")}
                        className={cn(
                          "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25 sm:flex-none",
                          busyId === user.userId && "opacity-50"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Valider
                      </button>
                      <button
                        type="button"
                        disabled={busyId === user.userId}
                        onClick={() => void decide(user, "REJECTED")}
                        className={cn(
                          "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-500/20 sm:flex-none",
                          busyId === user.userId && "opacity-50"
                        )}
                      >
                        <X className="h-3.5 w-3.5" />
                        Refuser
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </StaffPageShell>
    </>
  );
}
