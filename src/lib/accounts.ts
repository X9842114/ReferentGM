import { kvRead, kvWrite } from "@/lib/app-kv";
import { getSupabaseBrowserClient, withTimeout } from "@/lib/supabase";
import { CVE_BYPASS_GRADE, isCveBypassUser } from "@/lib/cve-access";
import { DEFAULT_GRADE, getGradeRank, normalizeGrade, type GradeId } from "@/lib/grades";
import {
  canChangeAccountGrade,
  canVerifyAccounts,
  type GradeChangeResult,
} from "@/lib/permissions";

export type AccountStatus = "PENDING" | "APPROVED" | "REJECTED";

export type RefgmAccount = {
  userId: string;
  displayName: string;
  discordAvatarUrl: string;
  discordLinked: boolean;
  status: AccountStatus;
  grade: GradeId;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

type AccountRow = {
  user_id: string;
  display_name: string;
  discord_avatar_url: string;
  discord_linked: boolean;
  status: AccountStatus;
  grade?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function rowToAccount(row: AccountRow): RefgmAccount {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    discordAvatarUrl: row.discord_avatar_url,
    discordLinked: row.discord_linked,
    status: row.status,
    grade: normalizeGrade(row.grade),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

function accountToUpsert(account: RefgmAccount) {
  return {
    user_id: account.userId,
    display_name: account.displayName,
    discord_avatar_url: account.discordAvatarUrl,
    discord_linked: account.discordLinked,
    status: account.status,
    grade: account.grade,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    reviewed_by: account.reviewedBy,
    reviewed_at: account.reviewedAt,
  };
}

const LOCAL_KEY = "refgm.accounts.v1";

function readLocal(): Record<string, RefgmAccount> {
  const parsed = kvRead<Record<string, RefgmAccount>>(LOCAL_KEY, {});
  const normalized: Record<string, RefgmAccount> = {};
  for (const [id, acc] of Object.entries(parsed)) {
    normalized[id] = {
      ...acc,
      grade: normalizeGrade(acc.grade),
    };
  }
  return normalized;
}

function writeLocal(dir: Record<string, RefgmAccount>, notify = true) {
  kvWrite(LOCAL_KEY, dir, notify ? "refgm:accounts-updated" : undefined);
}

function upsertLocal(account: RefgmAccount, notify = true) {
  const dir = readLocal();
  dir[account.userId] = account;
  writeLocal(dir, notify);
}

function normalizeSuggestedGrade(value?: GradeId | null): GradeId | null {
  const id = value?.trim();
  return id ? id : null;
}

function pickHigherGrade(current: GradeId, suggested: GradeId | null): GradeId {
  if (!suggested) return normalizeGrade(current);
  if (getGradeRank(suggested) < getGradeRank(current)) return suggested;
  return normalizeGrade(current);
}

/** Lecture synchrone locale — pour afficher le dashboard tout de suite. */
export function getAccountSync(userId: string): RefgmAccount | null {
  return readLocal()[userId] ?? null;
}

async function persistAccountSession() {
  try {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* le cache KV reste disponible hors ligne */
  }
}

/**
 * Crée le compte s’il n’existe pas.
 * - Compte Discord développeur listé → APPROVED + DEVELOPPEUR
 * - Sinon → PENDING jusqu’à validation référent
 */
export async function ensureAccount(input: {
  userId: string;
  displayName?: string | null;
  image?: string | null;
  discordLinked?: boolean;
  suggestedGrade?: GradeId | null;
}): Promise<RefgmAccount> {
  const bypass = isCveBypassUser(input.userId);
  const local = getAccountSync(input.userId);
  const remote = await getAccount(input.userId);
  let existing: RefgmAccount | null = remote ?? local;

  if (existing) {
    const fromDiscord = normalizeSuggestedGrade(input.suggestedGrade);
    const nextGrade = bypass
      ? CVE_BYPASS_GRADE
      : pickHigherGrade(existing.grade, fromDiscord);
    const patched: RefgmAccount = {
      ...existing,
      displayName:
        input.displayName?.trim() || existing.displayName || "Référent GM",
      discordAvatarUrl: input.image?.trim() || existing.discordAvatarUrl,
      discordLinked: Boolean(input.discordLinked ?? existing.discordLinked),
      status: bypass ? "APPROVED" : existing.status,
      grade: nextGrade,
      updatedAt: new Date().toISOString(),
      reviewedBy: bypass
        ? existing.reviewedBy ?? "cve-bypass"
        : existing.reviewedBy,
      reviewedAt: bypass
        ? existing.reviewedAt ?? new Date().toISOString()
        : existing.reviewedAt,
    };
    upsertLocal(patched, false);
    await persistAccountSession();
    return patched;
  }

  let status: AccountStatus = "PENDING";
  let grade: GradeId = DEFAULT_GRADE;

  if (bypass) {
    status = "APPROVED";
    grade = CVE_BYPASS_GRADE;
  } else {
    const fromDiscord = normalizeSuggestedGrade(input.suggestedGrade);
    if (fromDiscord) grade = fromDiscord;
  }

  const now = new Date().toISOString();
  const account: RefgmAccount = {
    userId: input.userId,
    displayName: input.displayName?.trim() || "Référent GM",
    discordAvatarUrl: input.image?.trim() || "",
    discordLinked: Boolean(input.discordLinked),
    status,
    grade,
    createdAt: now,
    updatedAt: now,
    reviewedBy: status === "APPROVED" ? "system" : null,
    reviewedAt: status === "APPROVED" ? now : null,
  };

  upsertLocal(account);
  await persistAccountSession();

  return account;
}

export async function getAccount(userId: string): Promise<RefgmAccount | null> {
  const local = readLocal()[userId] ?? null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    try {
      const response = await fetch(
        `/api/accounts?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      if (!response.ok) return local;
      const body = (await response.json()) as { account?: AccountRow | null };
      if (!body.account) return local;
      const account = rowToAccount(body.account);
      upsertLocal(account, false);
      return account;
    } catch {
      return local;
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("refgm_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
    );

    if (error || !data) return local;
    const account = rowToAccount(data as AccountRow);
    upsertLocal(account, false);
    return account;
  } catch {
    return local;
  }
}

export async function listAllAccounts(): Promise<RefgmAccount[]> {
  const localList = () =>
    Object.values(readLocal()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "fr")
    );

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    try {
      const response = await fetch("/api/accounts?list=1", { cache: "no-store" });
      if (response.ok) {
        const body = (await response.json()) as { accounts?: AccountRow[] };
        if (Array.isArray(body.accounts) && body.accounts.length > 0) {
          const list = body.accounts.map(rowToAccount);
          const dir: Record<string, RefgmAccount> = {};
          for (const a of list) dir[a.userId] = a;
          writeLocal(dir, false);
          return list.sort((a, b) =>
            a.displayName.localeCompare(b.displayName, "fr")
          );
        }
      }
    } catch {
      /* cache local */
    }
    return localList();
  }

  if (supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("refgm_accounts")
          .select("*")
          .order("display_name", { ascending: true })
      );
      if (!error && data) {
        const list = (data as AccountRow[]).map(rowToAccount);
        const dir = readLocal();
        for (const a of list) dir[a.userId] = a;
        writeLocal(dir, false);
        return list;
      }
      if (error) console.warn("[refgm] list accounts:", error.message);
    } catch {
      console.warn("[refgm] list accounts: timeout");
    }
  }

  return localList();
}

export async function listPendingAccounts(): Promise<RefgmAccount[]> {
  const localPending = () =>
    Object.values(readLocal())
      .filter((a) => a.status === "PENDING")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("refgm_accounts")
          .select("*")
          .eq("status", "PENDING")
          .order("created_at", { ascending: true })
      );
      if (!error && data) {
        const list = (data as AccountRow[]).map(rowToAccount);
        const dir = readLocal();
        for (const a of list) dir[a.userId] = a;
        writeLocal(dir, false);
        return list;
      }
      if (error) console.warn("[refgm] pending accounts:", error.message);
    } catch {
      console.warn("[refgm] pending accounts: timeout");
    }
  }

  return localPending();
}

export async function countPendingAccounts(): Promise<number> {
  const list = await listPendingAccounts();
  return list.length;
}

export async function reviewAccount(input: {
  targetUserId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
  grade?: GradeId;
}): Promise<RefgmAccount | null> {
  const reviewer =
    (await getAccount(input.reviewerId)) ?? getAccountSync(input.reviewerId);
  const reviewerCanVerify =
    isCveBypassUser(input.reviewerId) ||
    (reviewer ? canVerifyAccounts(reviewer.grade) : false);
  if (!reviewerCanVerify) {
    return null;
  }

  const current = await getAccount(input.targetUserId);
  if (!current || current.status !== "PENDING") return current;

  let grade = normalizeGrade(input.grade ?? current.grade);
  if (input.decision === "APPROVED" && reviewer) {
    const actorGrade = isCveBypassUser(input.reviewerId)
      ? CVE_BYPASS_GRADE
      : reviewer.grade;
    const check = canChangeAccountGrade(actorGrade, current.grade, grade);
    if (!check.ok) {
      grade = DEFAULT_GRADE;
      const fallback = canChangeAccountGrade(
        actorGrade,
        current.grade,
        grade
      );
      if (!fallback.ok) grade = DEFAULT_GRADE;
    }
  }

  // Écriture serveur (service role) — source de vérité, évite les upserts
  // navigateur qui réécrivaient PENDING par-dessus APPROVED.
  try {
    const response = await fetch("/api/accounts/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: input.targetUserId,
        decision: input.decision,
        grade: input.decision === "APPROVED" ? grade : undefined,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      account?: AccountRow;
      error?: string;
    };
    if (response.ok && body.account) {
      const updated = rowToAccount(body.account);
      upsertLocal(updated);
      return updated;
    }
    console.warn(
      "[refgm] review account api:",
      body.error ?? response.statusText
    );
  } catch (cause) {
    console.warn("[refgm] review account api failed:", cause);
  }

  // Fallback local + update client si l’API n’est pas dispo.
  const now = new Date().toISOString();
  const next: RefgmAccount = {
    ...current,
    status: input.decision,
    grade: input.decision === "APPROVED" ? grade : current.grade,
    reviewedBy: input.reviewerId,
    reviewedAt: now,
    updatedAt: now,
  };
  upsertLocal(next);

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("refgm_accounts")
          .update({
            status: next.status,
            grade: next.grade,
            reviewed_by: next.reviewedBy,
            reviewed_at: next.reviewedAt,
            updated_at: next.updatedAt,
          })
          .eq("user_id", next.userId)
          .eq("status", "PENDING")
          .select("*")
          .maybeSingle()
      );
      if (error) {
        console.warn("[refgm] review account:", error.message);
        return null;
      }
      if (data) {
        const updated = rowToAccount(data as AccountRow);
        upsertLocal(updated);
        return updated;
      }
    } catch {
      console.warn("[refgm] review account: timeout");
      return null;
    }
  }

  return next;
}

export async function setAccountGrade(input: {
  actorUserId: string;
  targetUserId: string;
  grade: GradeId;
}): Promise<{ account: RefgmAccount | null; result: GradeChangeResult }> {
  const actor = await getAccount(input.actorUserId);
  if (!actor) {
    return {
      account: null,
      result: { ok: false, reason: "Compte acteur introuvable." },
    };
  }

  const target = await getAccount(input.targetUserId);
  if (!target) {
    return {
      account: null,
      result: { ok: false, reason: "Compte cible introuvable." },
    };
  }

  const nextGrade = normalizeGrade(input.grade);
  const result = canChangeAccountGrade(actor.grade, target.grade, nextGrade);
  if (!result.ok) {
    return { account: target, result };
  }

  // L’attribution passe par le Route Handler : la permission est à nouveau
  // contrôlée avec le compte stocké dans Supabase, pas seulement dans le navigateur.
  try {
    const response = await fetch("/api/accounts/grade", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: input.targetUserId,
        grade: nextGrade,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      account?: AccountRow;
      error?: string;
    };
    if (response.ok && body.account) {
      const updated = rowToAccount(body.account);
      upsertLocal(updated);
      return { account: updated, result: { ok: true } };
    }
    return {
      account: target,
      result: {
        ok: false,
        reason: body.error ?? "Le serveur a refusé le changement de grade.",
      },
    };
  } catch {
    return {
      account: target,
      result: { ok: false, reason: "Service de grades indisponible." },
    };
  }

}
