import "server-only";

import { auth } from "@/auth";
import { isCveBypassUser } from "@/lib/cve-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  canAccessLeadTools,
  canAccessReferentHq,
  canGiveRewards,
  canOpenAdminHub,
  canAccessStaffTools,
  canManageGroups,
  canProposeGiveRequests,
  canProposeMissions,
  canReadMissions,
  canViewProfiles,
} from "@/lib/permissions";

export type ServerActor = {
  userId: string;
  displayName: string;
  grade: string;
};

async function loadApprovedActor(): Promise<ServerActor> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Response("Connexion requise.", { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("refgm_accounts")
    .select("user_id, display_name, grade, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Response(error.message, { status: 500 });
  if ((!data || data.status !== "APPROVED") && !isCveBypassUser(userId)) {
    throw new Response("Compte non approuvé.", { status: 403 });
  }
  const grade = data?.grade || "GAMEMASTER";

  return {
    userId,
    displayName: data?.display_name || session.user?.name || "Utilisateur",
    grade,
  };
}

export async function requireApprovedAccount(): Promise<ServerActor> {
  return loadApprovedActor();
}

export async function requireApprovedActor(): Promise<ServerActor> {
  const actor = await loadApprovedActor();
  if (!isCveBypassUser(actor.userId) && !canOpenAdminHub(actor.grade)) {
    throw new Response("Portail réservé aux Référents GM.", { status: 403 });
  }
  return actor;
}

export async function jsonAuthError(error: unknown) {
  if (error instanceof Response) {
    const text = await error.text();
    return Response.json(
      { error: text || "Refusé." },
      { status: error.status }
    );
  }
  const message = error instanceof Error ? error.message : "Erreur serveur.";
  return Response.json({ error: message }, { status: 500 });
}

const COLLABORATION_KEYS = new Set([
  "refgm.scene-workshops.v1",
  "refgm.team-chat.v1",
]);

const LEAD_KEYS = new Set([
  "refgm.staff.activity.v1",
  "refgm.staff.rapports.v1",
  "refgm.staff.tasks.v1",
  "refgm.staff.meeting-reminders.v1",
  "refgm.staff.broadcasts.v1",
  "refgm.staff.warnings.v1",
]);
const GM_CELLS_KEY = "refgm.staff.gm-cells.v1";

export function canWriteSharedKey(actor: ServerActor, key: string) {
  if (
    key === "refgm.accounts.v1" ||
    key === "refgm.presence.v1" ||
    key === "refgm.shared-state.meta.v1" ||
    key === "refgm.shared-state.conflict-backups.v1"
  ) {
    return false;
  }
  if (isCveBypassUser(actor.userId)) return true;
  if (key === GM_CELLS_KEY) return canAccessStaffTools(actor.grade) || canProposeMissions(actor.grade);
  if (key === "refgm.gm-weekly-groups.v1") return canManageGroups(actor.grade);
  if (key === "refgm.missions.v1") return canProposeMissions(actor.grade) || canReadMissions(actor.grade);
  if (key === "refgm.mission-review-settings.v1") return canAccessLeadTools(actor.grade);
  if (key === "refgm.give-requests.v1") return canProposeGiveRequests(actor.grade) || canAccessStaffTools(actor.grade);
  if (key === "refgm.product-roadmap.v1") return canAccessReferentHq(actor.grade);
  if (key === "refgm.group-rewards.v1" || key === "refgm.discord-missions.v1") {
    return (
      canAccessReferentHq(actor.grade) ||
      canAccessStaffTools(actor.grade) ||
      canGiveRewards(actor.grade)
    );
  }
  if (key === "refgm.rp-groups.v1") {
    return canAccessReferentHq(actor.grade) || canAccessStaffTools(actor.grade);
  }
  if (key === "refgm.referent-planning.v1") return canAccessReferentHq(actor.grade);
  if (key === "refgm.dev-feedback.v1") return canAccessReferentHq(actor.grade) || canAccessStaffTools(actor.grade);
  if (COLLABORATION_KEYS.has(key)) return canProposeMissions(actor.grade) || canReadMissions(actor.grade);
  if (LEAD_KEYS.has(key)) return canAccessLeadTools(actor.grade);
  return canAccessStaffTools(actor.grade);
}

export function canReadSharedKey(actor: ServerActor, key: string) {
  if (isCveBypassUser(actor.userId)) return true;
  if (key === "refgm.accounts.v1") return canAccessStaffTools(actor.grade);
  if (key === "refgm.profiles.directory.v1") {
    return canViewProfiles(actor.grade) || canAccessStaffTools(actor.grade);
  }
  if (key === GM_CELLS_KEY) return canAccessStaffTools(actor.grade) || canProposeMissions(actor.grade);
  if (key === "refgm.gm-weekly-groups.v1") return canManageGroups(actor.grade);
  if (LEAD_KEYS.has(key)) return canAccessLeadTools(actor.grade);
  if (key.startsWith("refgm.staff.")) return canAccessStaffTools(actor.grade);
  if (key.startsWith("refgm.or-market.")) return canAccessStaffTools(actor.grade);
  if (key === "refgm.missions.v1" || key === "refgm.mission-review-settings.v1" || COLLABORATION_KEYS.has(key) || key === "refgm.notifications.v1") return canProposeMissions(actor.grade) || canReadMissions(actor.grade) || canProposeGiveRequests(actor.grade);
  if (key === "refgm.give-requests.v1") return canProposeGiveRequests(actor.grade) || canAccessStaffTools(actor.grade);
  if (key === "refgm.product-roadmap.v1") return canAccessReferentHq(actor.grade);
  if (key === "refgm.group-rewards.v1" || key === "refgm.discord-missions.v1") {
    return (
      canAccessReferentHq(actor.grade) ||
      canAccessStaffTools(actor.grade) ||
      canGiveRewards(actor.grade)
    );
  }
  if (key === "refgm.rp-groups.v1") {
    return canAccessReferentHq(actor.grade) || canAccessStaffTools(actor.grade);
  }
  if (key === "refgm.referent-planning.v1") return canAccessReferentHq(actor.grade);
  if (key === "refgm.dev-feedback.v1") return canAccessReferentHq(actor.grade) || canAccessStaffTools(actor.grade);
  return canAccessStaffTools(actor.grade);
}

