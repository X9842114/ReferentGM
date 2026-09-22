export type SharedStateRecord = {
  key: string;
  payload: unknown;
  revision: number;
  updatedAt: string;
  updatedBy: string;
};

export const SHARED_STORAGE_KEYS = [
  "refgm.missions.v1",
  "refgm.mission-review-settings.v1",
  "refgm.staff.business.v1",
  "refgm.staff.blacklist.v1",
  "refgm.staff.revendications.v1",
  "refgm.staff.activity.v1",
  "refgm.staff.rapports.v1",
  "refgm.staff.reglements.v1",
  "refgm.staff.gm-cells.v1",
  "refgm.staff.welcomed-groups.v1",
  "refgm.staff.tasks.v1",
  "refgm.staff.meeting-reminders.v1",
  "refgm.staff.broadcasts.v1",
  "refgm.staff.warnings.v1",
  "refgm.give-requests.v1",
  "refgm.notifications.v1",
  "refgm.or-market.draws.v2",
  "refgm.or-market.carts.v1",
  "refgm.or-market.purchases.v1",
  "refgm.or-market.cumul.v1",
  "refgm.scene-workshops.v1",
  "refgm.team-chat.v1",
  "refgm.referent-planning.v1",
  "refgm.gm-weekly-groups.v1",
  "refgm.product-roadmap.v1",
  "refgm.group-rewards.v1",
  "refgm.discord-missions.v1",
  "refgm.rp-groups.v1",
  "refgm.dev-feedback.v1",
] as const;

export const SHARED_STATE_EVENTS = [
  "refgm:missions-updated",
  "refgm:staff-updated",
  "refgm:notifications-updated",
  "refgm:supervision-updated",
  "refgm:scene-workshops-updated",
  "refgm:chat-updated",
] as const;

export function readSharedLocalValue(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

