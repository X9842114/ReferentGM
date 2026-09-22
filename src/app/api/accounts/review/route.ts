import { auth } from "@/auth";
import { isCveBypassUser, CVE_BYPASS_GRADE } from "@/lib/cve-access";
import {
  PERMISSION_FLAGS,
  SYSTEM_GRADE_DEFS,
  granted,
  mergeGradeCatalog,
  type GradeDef,
  type GradeKind,
  type GradePatch,
  type PermissionFlagKey,
} from "@/lib/grade-registry";
import { DEFAULT_GRADE } from "@/lib/grades";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RequestBody = {
  targetUserId?: string;
  decision?: "APPROVED" | "REJECTED";
  grade?: string;
};

type GradeRow = {
  id: string;
  label: string;
  rank: number;
  color: string;
  kind: GradeDef["kind"];
  is_system: boolean;
  is_protected: boolean;
  permissions: Partial<Record<PermissionFlagKey, boolean>>;
};

function overlayRow(row: GradeRow): GradePatch {
  const overlay: GradePatch = {
    id: row.id,
    label: row.label,
    rank: row.rank,
    color: row.color,
    kind: row.kind,
    isSystem: row.is_system,
    isProtected: row.is_protected,
  };
  const source = row.permissions ?? {};
  for (const { key } of PERMISSION_FLAGS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      overlay[key] = source[key] === true;
    }
  }
  return overlay;
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return fail("Connexion requise.", 401);

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const targetUserId = body?.targetUserId?.trim();
  const decision = body?.decision;
  const requestedGrade = body?.grade?.trim();
  if (!targetUserId || (decision !== "APPROVED" && decision !== "REJECTED")) {
    return fail("Cible ou décision invalide.");
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (cause) {
    return fail(
      cause instanceof Error
        ? cause.message
        : "Configuration serveur manquante.",
      503
    );
  }

  const { data: accounts, error: accountsError } = await admin
    .from("refgm_accounts")
    .select("*")
    .in("user_id", [actorId, targetUserId]);
  if (accountsError) return fail(accountsError.message, 500);

  const actor = accounts?.find((row) => row.user_id === actorId);
  const target = accounts?.find((row) => row.user_id === targetUserId);
  if (!target) return fail("Compte cible introuvable.", 404);
  if (target.status !== "PENDING") {
    return fail("Ce compte n’est plus en attente.", 409);
  }

  const { data: dynamicRows } = await admin.from("refgm_grade_defs").select("*");
  const definitions = mergeGradeCatalog(
    ((dynamicRows ?? []) as GradeRow[]).map(overlayRow)
  );

  const actorGrade =
    definitions.find((grade) => grade.id === actor?.grade) ??
    (isCveBypassUser(actorId)
      ? SYSTEM_GRADE_DEFS.find((grade) => grade.id === CVE_BYPASS_GRADE)
      : undefined);

  if (
    !(actorGrade && granted(actorGrade, "verifyAccounts")) &&
    !isCveBypassUser(actorId)
  ) {
    return fail("Permission « Vérifier les comptes » requise.", 403);
  }

  let nextGrade =
    decision === "APPROVED"
      ? requestedGrade || target.grade || DEFAULT_GRADE
      : target.grade;
  if (decision === "APPROVED") {
    const known = definitions.some((grade) => grade.id === nextGrade);
    if (!known) nextGrade = DEFAULT_GRADE;
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("refgm_accounts")
    .update({
      status: decision,
      grade: nextGrade,
      reviewed_by: actorId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("user_id", targetUserId)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!data) return fail("Mise à jour impossible (compte déjà traité).", 409);

  const { dispatchDiscordEvent } = await import("@/lib/discord-bridge");
  void dispatchDiscordEvent(
    {
      type: "account.reviewed",
      displayName: String(data.display_name ?? targetUserId),
      userId: targetUserId,
      decision,
      grade: decision === "APPROVED" ? String(data.grade ?? "") : null,
      reviewerName: session?.user?.name ?? actorId,
    },
    { id: actorId, name: session?.user?.name }
  );

  return Response.json({ account: data });
}
