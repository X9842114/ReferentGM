import {
  SYSTEM_GRADE_DEFS,
  getGradeDef,
  listGradeDefs,
  gradeLabel,
} from "@/lib/grade-registry";

export const GRADES = SYSTEM_GRADE_DEFS.map((g) => g.id);

/** Un grade système ou personnalisé enregistré dans refgm_grade_defs. */
export type GradeId = string;

export const DEFAULT_GRADE: GradeId = "REFERENT";

export const GRADE_LABELS: Record<string, string> = Object.fromEntries(
  SYSTEM_GRADE_DEFS.map((g) => [g.id, g.label])
);

export function getGradeLabel(id: string): string {
  return gradeLabel(id) || GRADE_LABELS[id] || id;
}

export function getAllGradeIds(): string[] {
  return listGradeDefs().map((g) => g.id);
}

export function getGradeRank(id: string): number {
  return getGradeDef(id).rank;
}

export function normalizeGrade(value: string | null | undefined): GradeId {
  return value?.trim() || DEFAULT_GRADE;
}
