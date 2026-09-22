import { auth } from "@/auth";
import { isCveBypassUser } from "@/lib/cve-access";
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
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type GradeRow = {
  id: string;
  label: string;
  rank: number;
  color: string;
  kind: GradeKind;
  is_system: boolean;
  is_protected: boolean;
  permissions: Partial<Record<PermissionFlagKey, boolean>>;
};

const validKinds = new Set<GradeKind>(["REFERENT", "GAMEMASTER", "DEV"]);
const validId = /^[A-Z][A-Z0-9_]{2,47}$/;

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function permissions(value: unknown): Record<PermissionFlagKey, boolean> {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    PERMISSION_FLAGS.map(({ key }) => [key, source[key] === true])
  ) as Record<PermissionFlagKey, boolean>;
}

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

function rowToGrade(row: GradeRow): GradeDef {
  return {
    id: row.id,
    label: row.label,
    rank: row.rank,
    color: row.color,
    kind: row.kind,
    isSystem: row.is_system,
    isProtected: row.is_protected,
    ...permissions(row.permissions),
  };
}

async function requireGradeManager() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { response: error("Connexion requise.", 401) };

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (cause) {
    return {
      response: error(
        cause instanceof Error ? cause.message : "Configuration serveur manquante.",
        503
      ),
    };
  }

  const [{ data: account }, { data: rows }] = await Promise.all([
    admin
      .from("refgm_accounts")
      .select("grade")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("refgm_grade_defs").select("*"),
  ]);

  const catalog = mergeGradeCatalog(((rows ?? []) as GradeRow[]).map(overlayRow));
  const actor =
    catalog.find((grade) => grade.id === account?.grade) ??
    SYSTEM_GRADE_DEFS.find((grade) => grade.id === account?.grade);

  if (
    !(actor && granted(actor, "manageGrades")) &&
    !isCveBypassUser(userId)
  ) {
    return { response: error("Permission « Gérer les grades » requise.", 403) };
  }
  return {
    admin,
    actor:
      actor ?? SYSTEM_GRADE_DEFS.find((grade) => grade.id === "DEVELOPPEUR")!,
    userId,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return error("Connexion requise.", 401);
  try {
    const admin = getSupabaseAdmin();
    const { data, error: dbError } = await admin
      .from("refgm_grade_defs")
      .select("*")
      .order("rank", { ascending: true });
    if (dbError) return Response.json({ grades: SYSTEM_GRADE_DEFS });
    const custom = ((data ?? []) as GradeRow[]).map(overlayRow);
    return Response.json({ grades: mergeGradeCatalog(custom) });
  } catch {
    return Response.json({ grades: SYSTEM_GRADE_DEFS });
  }
}

function parse(body: unknown) {
  const source = body as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id.trim().toUpperCase() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";
  const rank = Number(source.rank);
  const color = typeof source.color === "string" ? source.color.trim() : "";
  const kind = source.kind as GradeKind;
  if (!validId.test(id)) return { error: "Identifiant invalide (A-Z, chiffres et _)." };
  if (!label || label.length > 80) return { error: "Libellé invalide." };
  if (!Number.isInteger(rank) || rank < 0 || rank > 999)
    return { error: "Rang invalide." };
  if (!/^#[\da-fA-F]{6}$/.test(color)) return { error: "Couleur hexadécimale invalide." };
  if (!validKinds.has(kind)) return { error: "Type de rôle invalide." };
  return { value: { id, label, rank, color, kind, permissions: permissions(source.permissions) } };
}

export async function POST(request: Request) {
  const result = await requireGradeManager();
  if ("response" in result) return result.response;
  const parsed = parse(await request.json().catch(() => null));
  if ("error" in parsed) return error(parsed.error ?? "Données invalides.");
  if (parsed.value.id === "DEVELOPPEUR" || parsed.value.kind === "DEV") {
    return error("Le rôle Développeur ne se crée pas.", 403);
  }
  if (SYSTEM_GRADE_DEFS.some((grade) => grade.id === parsed.value.id)) {
    return error("Ce rôle existe déjà. Ouvre-le pour le modifier.");
  }

  const { data, error: dbError } = await result.admin
    .from("refgm_grade_defs")
    .insert({
      ...parsed.value,
      is_system: false,
      is_protected: false,
    })
    .select("*")
    .single();
  if (dbError || !data) return error(dbError?.message ?? "Création impossible.");
  return Response.json({ grade: rowToGrade(data as GradeRow) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const result = await requireGradeManager();
  if ("response" in result) return result.response;
  const parsed = parse(await request.json().catch(() => null));
  if ("error" in parsed) return error(parsed.error ?? "Données invalides.");
  if (parsed.value.id === "DEVELOPPEUR" || parsed.value.kind === "DEV") {
    return error("Le rôle Développeur ne se modifie pas.", 403);
  }
  const system = SYSTEM_GRADE_DEFS.find((grade) => grade.id === parsed.value.id);
  const payload = {
    ...parsed.value,
    is_system: Boolean(system),
    is_protected: Boolean(system?.isProtected),
    kind: system?.kind ?? parsed.value.kind,
  };

  const { data, error: dbError } = await result.admin
    .from("refgm_grade_defs")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (dbError || !data) return error(dbError?.message ?? "Enregistrement impossible.");
  return Response.json({ grade: rowToGrade(data as GradeRow) });
}

export async function DELETE(request: Request) {
  const result = await requireGradeManager();
  if ("response" in result) return result.response;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id?.trim().toUpperCase();
  if (!id || SYSTEM_GRADE_DEFS.some((grade) => grade.id === id)) {
    return error("Ce rôle ne peut pas être supprimé.", 403);
  }
  const { count: assigned } = await result.admin
    .from("refgm_accounts")
    .select("*", { count: "exact", head: true })
    .eq("grade", id);
  if (assigned) {
    return error(
      "Ce rôle est encore attribué. Réattribue d’abord les comptes concernés.",
      409
    );
  }
  const { count, error: dbError } = await result.admin
    .from("refgm_grade_defs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("is_system", false);
  if (dbError) return error(dbError.message);
  if (!count) return error("Rôle introuvable.", 404);
  return Response.json({ ok: true });
}
