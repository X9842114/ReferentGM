import {
  PERMISSION_FLAGS,
  type GradeDef,
  type GradeKind,
  type PermissionFlagKey,
} from "@/lib/grade-registry";

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

export type EditableGrade = Pick<
  GradeDef,
  "id" | "label" | "rank" | "color" | "kind"
> & {
  permissions: Record<PermissionFlagKey, boolean>;
};

export function emptyPermissions(): Record<PermissionFlagKey, boolean> {
  return Object.fromEntries(
    PERMISSION_FLAGS.map(({ key }) => [key, false])
  ) as Record<PermissionFlagKey, boolean>;
}

export function toEditableGrade(grade: GradeDef): EditableGrade {
  return {
    id: grade.id,
    label: grade.label,
    rank: grade.rank,
    color: grade.color,
    kind: grade.kind,
    permissions: Object.fromEntries(
      PERMISSION_FLAGS.map(({ key }) => [key, grade[key]])
    ) as Record<PermissionFlagKey, boolean>,
  };
}

function rowToGrade(row: GradeRow): GradeDef {
  const permissions = { ...emptyPermissions(), ...(row.permissions ?? {}) };
  return {
    id: row.id,
    label: row.label,
    rank: row.rank,
    color: row.color,
    kind: row.kind,
    isSystem: row.is_system,
    isProtected: row.is_protected,
    ...permissions,
  };
}

/** Lecture publique des définitions ; les mutations passent par l’API serveur. */
export async function listRemoteGradeDefs(): Promise<GradeDef[]> {
  try {
    const response = await fetch("/api/grades", { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as { grades?: GradeDef[] };
    return Array.isArray(body.grades) ? body.grades : [];
  } catch {
    return [];
  }
}

async function mutateGrade(
  method: "POST" | "PATCH" | "DELETE",
  payload: object
): Promise<{ grade?: GradeDef; error?: string }> {
  const response = await fetch("/api/grades", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    grade?: GradeDef;
    error?: string;
  };
  if (!response.ok) return { error: body.error || "Action impossible." };
  return body;
}

export function createGrade(grade: EditableGrade) {
  return mutateGrade("POST", grade);
}

export function updateGrade(grade: EditableGrade) {
  return mutateGrade("PATCH", grade);
}

export function deleteGrade(id: string) {
  return mutateGrade("DELETE", { id });
}
