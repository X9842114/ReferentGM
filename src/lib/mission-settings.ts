import { kvRead, kvWrite } from "@/lib/app-kv";
import { granted } from "@/lib/grade-registry";
import type { GradeId } from "@/lib/grades";

export type MissionReviewMode = "READ" | "VOTE";

export type MissionReviewSettings = {
  reviewMode: MissionReviewMode;
  voteQuorum: number;
  updatedAt: string;
  updatedBy: string | null;
};

const KEY = "refgm.mission-review-settings.v1";
export const DEFAULT_MISSION_VOTE_QUORUM = 2;

export function getMissionReviewSettings(): MissionReviewSettings {
  const fallback: MissionReviewSettings = {
    reviewMode: "READ",
    voteQuorum: DEFAULT_MISSION_VOTE_QUORUM,
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
  };
  const parsed = kvRead<Partial<MissionReviewSettings> | null>(KEY, null);
  if (!parsed) return fallback;
  return {
    reviewMode: parsed.reviewMode === "VOTE" ? "VOTE" : "READ",
    voteQuorum: clampQuorum(parsed.voteQuorum),
    updatedAt: parsed.updatedAt || fallback.updatedAt,
    updatedBy: parsed.updatedBy ?? null,
  };
}

function clampQuorum(n: unknown) {
  const v = Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return DEFAULT_MISSION_VOTE_QUORUM;
  return Math.min(10, Math.max(1, v));
}

export function setMissionReviewSettings(input: {
  reviewMode: MissionReviewMode;
  voteQuorum: number;
  updatedBy: string;
}): MissionReviewSettings {
  const next: MissionReviewSettings = {
    reviewMode: input.reviewMode === "VOTE" ? "VOTE" : "READ",
    voteQuorum: clampQuorum(input.voteQuorum),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  kvWrite(KEY, next, "refgm:mission-settings-updated");
  return next;
}

export function canConfigureMissionReview(grade: GradeId) {
  return granted(grade, "accessMissionRules");
}

export function canSeeReadChronometer(grade: GradeId) {
  return granted(grade, "accessMissionRules") || granted(grade, "accessSupervision");
}
