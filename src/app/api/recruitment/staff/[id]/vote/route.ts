import { canAccessStaffTools } from "@/lib/permissions";
import { requireApprovedActor } from "@/lib/server-authorization";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";

const DECISIONS = ["FAVORABLE", "CONDITIONAL", "MORE_INFO", "UNFAVORABLE", "ABSTAIN"] as const;
const DECISION_QUORUM = 2;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessStaffTools(actor.grade)) return Response.json({ error: "Accès réservé au staff." }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json().catch(() => null) as { decision?: string; comment?: string } | null;
    const decision = body?.decision || "";
    const comment = String(body?.comment || "").trim().slice(0, 2000);
    if (!DECISIONS.includes(decision as never)) return Response.json({ error: "Vote invalide." }, { status: 400 });
    if (["CONDITIONAL", "MORE_INFO", "UNFAVORABLE"].includes(decision) && !comment) return Response.json({ error: "Explique ce vote dans un commentaire." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: application, error: applicationError } = await admin.from("refgm_gm_applications").select("status").eq("id", id).maybeSingle();
    if (applicationError) return Response.json({ error: applicationError.message }, { status: 500 });
    if (!application) return Response.json({ error: "Candidature introuvable." }, { status: 404 });
    if (["ACCEPTED", "REJECTED", "CLOSED"].includes(application.status)) return Response.json({ error: "Les votes sont fermés pour cette candidature." }, { status: 409 });
    const now = new Date().toISOString();
    const row = { application_id: id, voter_id: actor.userId, voter_name: actor.displayName, decision, comment, updated_at: now };
    const { data, error } = await admin.from("refgm_gm_application_votes").upsert(row, { onConflict: "application_id,voter_id" }).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const { count: expressedVotes } = await admin
      .from("refgm_gm_application_votes")
      .select("id", { count: "exact", head: true })
      .eq("application_id", id)
      .neq("decision", "ABSTAIN");
    const applicationStatus = (expressedVotes ?? 0) >= DECISION_QUORUM
      ? "DECISION_PENDING"
      : application.status;
    if (applicationStatus !== application.status) await admin.from("refgm_gm_applications").update({ status: applicationStatus, updated_at: now }).eq("id", id);
    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action: "recruitment.vote_cast", entityType: "gm_application", entityId: id, metadata: { decision, hasComment: Boolean(comment) } });
    return Response.json({ vote: data, applicationStatus, quorum: DECISION_QUORUM, expressedVotes: expressedVotes ?? 0 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Vote impossible." }, { status: 500 });
  }
}
