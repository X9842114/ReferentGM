import { auth } from "@/auth";
import { isCveBypassUser } from "@/lib/cve-access";
import {
  PERMISSION_FLAGS,
  SYSTEM_GRADE_DEFS,
  granted,
  mergeGradeCatalog,
  setCustomGradeDefs,
  type GradeDef,
  type GradeKind,
  type GradePatch,
  type PermissionFlagKey,
} from "@/lib/grade-registry";
import { canChangeAccountGrade, isDeveloper } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RequestBody = { targetUserId?: string; grade?: string };
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

export async function PATCH(request: Request) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return fail("Connexion requise.", 401);

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const targetUserId = body?.targetUserId?.trim();
  const nextGrade = body?.grade?.trim();
  if (!targetUserId || !nextGrade) return fail("Cible ou grade manquant.");

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (cause) {
    return fail(
      cause instanceof Error ? cause.message : "Configuration serveur manquante.",
      503
    );
  }

  const { data: accounts, error: accountsError } = await admin
    .from("refgm_accounts")
    .select("user_id, grade")
    .in("user_id", [actorId, targetUserId]);
  if (accountsError) return fail(accountsError.message, 500);

  const actor = accounts?.find((account) => account.user_id === actorId);
  const target = accounts?.find((account) => account.user_id === targetUserId);
  if (!actor || !target) return fail("Compte introuvable.", 404);

  const { data: dynamicRows } = await admin.from("refgm_grade_defs").select("*");
  const definitions = mergeGradeCatalog(
    ((dynamicRows ?? []) as GradeRow[]).map(overlayRow)
  );
  setCustomGradeDefs(definitions);
  const actorGrade =
    definitions.find((grade) => grade.id === actor.grade) ??
    (isCveBypassUser(actorId)
      ? SYSTEM_GRADE_DEFS.find((grade) => grade.id === "DEVELOPPEUR")
      : undefined);
  const previousGrade = definitions.find((grade) => grade.id === target.grade);
  const requestedGrade = definitions.find((grade) => grade.id === nextGrade);

  if (
    !(actorGrade && granted(actorGrade, "manageGrades")) &&
    !isCveBypassUser(actorId)
  ) {
    return fail("Permission « Gérer les grades » requise.", 403);
  }
  if (!requestedGrade) return fail("Grade invalide.");

  const check = canChangeAccountGrade(
    actorGrade?.id ?? actor.grade,
    previousGrade?.id ?? target.grade,
    requestedGrade.id
  );
  if (!check.ok && !isCveBypassUser(actorId)) {
    return fail(check.reason, 403);
  }
  if (isDeveloper(requestedGrade.id) || isDeveloper(previousGrade?.id ?? target.grade)) {
    if (!isCveBypassUser(actorId)) {
      return fail("Le grade Développeur ne se modifie pas.", 403);
    }
  }

  const { data, error } = await admin
    .from("refgm_accounts")
    .update({ grade: nextGrade, updated_at: new Date().toISOString() })
    .eq("user_id", targetUserId)
    .select("*")
    .single();
  if (error || !data) return fail(error?.message ?? "Mise à jour impossible.", 500);

  const { dispatchDiscordEvent } = await import("@/lib/discord-bridge");
  void dispatchDiscordEvent(
    {
      type: "account.grade",
      displayName: String(data.display_name ?? targetUserId),
      userId: targetUserId,
      grade: nextGrade,
      actorName: session?.user?.name ?? actorId,
    },
    { id: actorId, name: session?.user?.name }
  );

  return Response.json({ account: data });
}
