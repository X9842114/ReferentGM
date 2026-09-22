import {
  getGradeDef,
  granted,
  isValidGradeId,
  listGradeDefs,
  type PermissionFlagKey,
} from "@/lib/grade-registry";
import {
  DEFAULT_GRADE,
  getGradeLabel,
  getGradeRank,
  type GradeId,
} from "@/lib/grades";

export type { GradeId };
export { getGradeLabel, DEFAULT_GRADE, granted };

function has(grade: GradeId, key: PermissionFlagKey): boolean {
  return granted(grade, key);
}

export function canAccessLeadTools(grade: GradeId): boolean {
  return has(grade, "accessSupervision");
}

export function canAccessMeetingReports(grade: GradeId): boolean {
  return has(grade, "accessRapports");
}

export function canEditReglements(grade: GradeId): boolean {
  return has(grade, "editReglements");
}

export function isReferent(grade: GradeId): boolean {
  const kind = getGradeDef(grade).kind;
  return kind === "REFERENT" || kind === "DEV";
}

export function isGameMaster(grade: GradeId): boolean {
  return getGradeDef(grade).kind === "GAMEMASTER";
}

export function isDeveloper(grade: GradeId): boolean {
  const raw = String(grade ?? "").trim();
  const id = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (
    id === "DEVELOPPEUR" ||
    id === "DEVELOPER" ||
    id === "DEV" ||
    id.endsWith("_DEV")
  ) {
    return true;
  }
  const def = getGradeDef(raw);
  if (def.kind === "DEV") return true;
  const hay = `${def.label} ${def.id} ${raw}`.toLowerCase();
  return /d[eé]veloppeur/.test(hay);
}

/** Visible dans l’annuaire Référents (jamais le Développeur). */
export function isListedReferent(grade: GradeId): boolean {
  return isReferent(grade) && !isDeveloper(grade);
}

/** Accès au QG référents (pas les GameMasters, sauf accès total / accueil). */
export function canAccessReferentHq(grade: GradeId): boolean {
  if (isDeveloper(grade) || has(grade, "fullAccess") || has(grade, "accessHome")) {
    return true;
  }
  return isReferent(grade);
}

export function canAccessHome(grade: GradeId): boolean {
  return has(grade, "accessHome") || isGameMaster(grade) || isReferent(grade);
}

export function canAccessSuiviGroupes(grade: GradeId): boolean {
  return has(grade, "accessSuiviGroupes") || has(grade, "logGroupMissions");
}

export function canAccessPlanning(grade: GradeId): boolean {
  return has(grade, "accessPlanning") || has(grade, "joinPlanning") || has(grade, "managePlanning");
}

export function canAccessTrames(grade: GradeId): boolean {
  return has(grade, "accessTrames") || has(grade, "editTrames");
}

export function canAccessAvancement(grade: GradeId): boolean {
  return has(grade, "accessAvancement") || has(grade, "voteRoadmap");
}

export function canAccessMissionsGm(grade: GradeId): boolean {
  return has(grade, "accessMissionsGm") || canAccessReferentHq(grade);
}

export function canAccessChat(grade: GradeId): boolean {
  return has(grade, "accessChat");
}

export function canAccessBlacklist(grade: GradeId): boolean {
  return has(grade, "accessBlacklist");
}

export function canAccessBusiness(grade: GradeId): boolean {
  return has(grade, "accessBusiness");
}

export function canAccessRevendications(grade: GradeId): boolean {
  return has(grade, "accessRevendications");
}

export function canAccessMarcheOr(grade: GradeId): boolean {
  return has(grade, "accessMarcheOr");
}

export function canAccessReglementsPage(grade: GradeId): boolean {
  return has(grade, "accessReglements") || has(grade, "editReglements");
}

export function canAccessActivite(grade: GradeId): boolean {
  return has(grade, "accessActivite");
}

export function canConfigureMissionReview(grade: GradeId): boolean {
  return has(grade, "accessMissionRules");
}

export function canProposeMissions(grade: GradeId): boolean {
  return has(grade, "accessMissions");
}

export function canConfigureApp(grade: GradeId): boolean {
  return has(grade, "configureApp");
}

export function canAccessMissions(grade: GradeId): boolean {
  return has(grade, "accessMissions");
}

export function canReadMissions(grade: GradeId): boolean {
  return has(grade, "readMissions") || has(grade, "validateMissions");
}

export function canValidateMissions(grade: GradeId): boolean {
  return has(grade, "validateMissions") || has(grade, "readMissions");
}

export function canGiveRewards(grade: GradeId): boolean {
  return has(grade, "giveRewards");
}

export function canProposeGiveRequests(grade: GradeId): boolean {
  return canGiveRewards(grade) || has(grade, "accessDemandesGive") || canReviewGiveRequests(grade);
}

export function canReviewGiveRequests(grade: GradeId): boolean {
  return has(grade, "reviewGiveRequests") || has(grade, "accessDemandesGive");
}

export function canAccessGiveRequests(grade: GradeId): boolean {
  return canProposeGiveRequests(grade) || canReviewGiveRequests(grade);
}

export function canAccessRewards(grade: GradeId): boolean {
  return has(grade, "accessRewards") || canGiveRewards(grade);
}

export function canManageGrades(grade: GradeId): boolean {
  return has(grade, "manageGrades");
}

export function canManageGroups(grade: GradeId): boolean {
  return has(grade, "manageGroups");
}

export function canBrowseGroups(grade: GradeId): boolean {
  return has(grade, "browseGroups") || has(grade, "accessGroupes") || canManageGroups(grade);
}

export function canAccessStaffTools(grade: GradeId): boolean {
  return has(grade, "staffTools");
}

export function canAccessBaremes(grade: GradeId): boolean {
  return has(grade, "accessBaremes") || canGiveRewards(grade);
}

export function canManageGameMasters(grade: GradeId): boolean {
  return has(grade, "accessGamemasters") || has(grade, "manageGamemasters");
}

export function canViewProfiles(grade: GradeId): boolean {
  return has(grade, "viewProfiles") || has(grade, "accessReferents");
}

export function canVerifyAccounts(grade: GradeId): boolean {
  return has(grade, "verifyAccounts");
}

export function canDemoteSuperviseur(grade: GradeId): boolean {
  return has(grade, "demoteSuperviseur");
}

export function canAccessStatistics(grade: GradeId): boolean {
  return has(grade, "accessStatistiques");
}

export function canOpenAdminHub(grade: GradeId): boolean {
  return (
    has(grade, "accessAdministration") ||
    canAccessStaffTools(grade) ||
    canVerifyAccounts(grade) ||
    canManageGrades(grade)
  );
}

export function canSubmitDevFeedback(grade: GradeId): boolean {
  return has(grade, "accessSignalements") || canAccessReferentHq(grade);
}

export function canTriageDevFeedback(grade: GradeId): boolean {
  return has(grade, "triageFeedback") || isDeveloper(grade);
}

export function canAccessPath(pathname: string, grade: GradeId): boolean {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";

  if (path === "/dashboard") return canAccessHome(grade);
  if (path === "/dashboard/profil" || path.startsWith("/dashboard/profil/")) {
    return true;
  }
  if (path.startsWith("/dashboard/referents")) {
    return canViewProfiles(grade);
  }

  const rules: { prefix: string; allow: (g: GradeId) => boolean }[] = [
    { prefix: "/dashboard/suivi-groupes", allow: canAccessSuiviGroupes },
    { prefix: "/dashboard/missions-gm", allow: canAccessMissionsGm },
    { prefix: "/dashboard/propositions", allow: (g) => has(g, "accessPropositions") },
    { prefix: "/dashboard/planning", allow: canAccessPlanning },
    { prefix: "/dashboard/trames", allow: canAccessTrames },
    { prefix: "/dashboard/avancement", allow: canAccessAvancement },
    { prefix: "/dashboard/roadmap", allow: canAccessAvancement },
    { prefix: "/dashboard/signaler", allow: canSubmitDevFeedback },
    { prefix: "/dashboard/signalements", allow: canSubmitDevFeedback },
    { prefix: "/dashboard/brouillons", allow: (g) => has(g, "accessPropositions") },
    { prefix: "/dashboard/regles-missions", allow: canConfigureMissionReview },
    { prefix: "/dashboard/missions-regles", allow: canConfigureMissionReview },
    { prefix: "/dashboard/groupes", allow: canBrowseGroups },
    { prefix: "/dashboard/validation", allow: canVerifyAccounts },
    { prefix: "/dashboard/grades", allow: canManageGrades },
    { prefix: "/dashboard/administration", allow: canOpenAdminHub },
    { prefix: "/dashboard/apercu", allow: canAccessHome },
    { prefix: "/dashboard/preview", allow: canAccessHome },
    { prefix: "/dashboard/statistiques", allow: canAccessStatistics },
    { prefix: "/dashboard/supervision", allow: canAccessLeadTools },
    { prefix: "/dashboard/baremes", allow: canAccessBaremes },
    { prefix: "/dashboard/tableaux", allow: canAccessBaremes },
    { prefix: "/dashboard/marche-or", allow: canAccessMarcheOr },
    { prefix: "/dashboard/business", allow: canAccessBusiness },
    { prefix: "/dashboard/gamemasters", allow: canManageGameMasters },
    { prefix: "/dashboard/demandes-give", allow: canReviewGiveRequests },
    { prefix: "/dashboard/revendications", allow: canAccessRevendications },
    { prefix: "/dashboard/blacklist", allow: canAccessBlacklist },
    { prefix: "/dashboard/activite", allow: canAccessActivite },
    { prefix: "/dashboard/rapports", allow: canAccessMeetingReports },
    { prefix: "/dashboard/reglements", allow: canAccessReglementsPage },
    { prefix: "/dashboard/chat", allow: canAccessChat },
    { prefix: "/dashboard/missions", allow: canReadMissions },
    { prefix: "/dashboard/atelier", allow: (g) => has(g, "accessAtelier") },
  ];

  for (const rule of rules) {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      return rule.allow(grade);
    }
  }

  if (path.startsWith("/dashboard")) {
    return has(grade, "staffTools") || isReferent(grade);
  }

  return true;
}

export type GradeChangeResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Dev, Superviseur, Responsable, Lead et Co-lead peuvent poser
 * tous les rôles sauf Développeur.
 */
export function canAssignAllGrades(grade: GradeId): boolean {
  if (isDeveloper(grade) || has(grade, "fullAccess")) return true;
  if (!has(grade, "assignGrades") && !canManageGrades(grade)) return false;
  return (
    grade === "SUPERVISEUR_GM" ||
    grade === "RESPONSABLE" ||
    grade === "LEAD_REFERENT" ||
    grade === "CO_LEAD_REFERENT" ||
    getGradeRank(grade) <= getGradeRank("CO_LEAD_REFERENT")
  );
}

export function canChangeAccountGrade(
  actorGrade: GradeId,
  targetCurrentGrade: GradeId,
  nextGrade: GradeId
): GradeChangeResult {
  if (!canManageGrades(actorGrade) && !has(actorGrade, "assignGrades")) {
    return { ok: false, reason: "Tu n’as pas la permission de gérer les grades." };
  }
  if (!isValidGradeId(nextGrade)) {
    return { ok: false, reason: "Grade invalide." };
  }
  if (isDeveloper(targetCurrentGrade) || isDeveloper(nextGrade)) {
    return {
      ok: false,
      reason: "Le grade Développeur ne se modifie pas.",
    };
  }

  if (canAssignAllGrades(actorGrade)) return { ok: true };

  const touchingSuperviseur =
    targetCurrentGrade === "SUPERVISEUR_GM" || nextGrade === "SUPERVISEUR_GM";
  if (touchingSuperviseur) {
    return {
      ok: false,
      reason: "Tu ne peux pas assigner ou retirer Superviseur.",
    };
  }

  return { ok: true };
}

export function assignableGradesFor(actorGrade: GradeId): GradeId[] {
  const all = listAssignableIds().filter((id) => !isDeveloper(id));
  if (canAssignAllGrades(actorGrade)) return all;
  return all.filter((id) => id !== "SUPERVISEUR_GM");
}

function listAssignableIds(): GradeId[] {
  return listGradeDefs().map((grade) => grade.id);
}

export function isValidGrade(value: string): value is GradeId {
  return isValidGradeId(value);
}
