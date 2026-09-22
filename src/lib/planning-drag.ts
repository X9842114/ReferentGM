import type { DragEvent } from "react";

export type PlanningMateDrag = {
  userId: string;
  userName: string;
};

let live: PlanningMateDrag | null = null;

export function beginPlanningMateDrag(
  event: DragEvent,
  mate: PlanningMateDrag
) {
  live = mate;
  const payload = JSON.stringify(mate);
  event.dataTransfer.setData("text/plain", payload);
  event.dataTransfer.effectAllowed = "copy";
}

export function peekPlanningMate() {
  return live;
}

export function endPlanningMateDrag() {
  live = null;
}

export function mateFromDrop(event: DragEvent): PlanningMateDrag | null {
  if (live?.userId) return live;
  try {
    const raw = event.dataTransfer.getData("text/plain");
    const data = JSON.parse(raw) as PlanningMateDrag;
    if (!data?.userId || !data?.userName) return null;
    return data;
  } catch {
    return null;
  }
}
