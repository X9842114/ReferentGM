import { canAccessStaffTools } from "@/lib/permissions";
import { RECRUITMENT_STATUSES, type VoiceSlot } from "@/lib/recruitment";
import { requireApprovedActor } from "@/lib/server-authorization";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["ANALYZING", "STAFF_REVIEW", "MORE_INFO", "VOICE_PROPOSED", "DECISION_PENDING", "ACCEPTED", "REJECTED", "CLOSED"],
  ANALYZING: ["STAFF_REVIEW", "MORE_INFO", "VOICE_PROPOSED", "DECISION_PENDING", "ACCEPTED", "REJECTED", "CLOSED"],
  STAFF_REVIEW: ["MORE_INFO", "VOICE_PROPOSED", "DECISION_PENDING", "ACCEPTED", "REJECTED", "CLOSED"],
  MORE_INFO: ["STAFF_REVIEW", "VOICE_PROPOSED", "DECISION_PENDING", "ACCEPTED", "REJECTED", "CLOSED"],
  VOICE_PROPOSED: ["VOICE_PROPOSED", "DECISION_PENDING", "MORE_INFO", "ACCEPTED", "REJECTED", "CLOSED"],
  DECISION_PENDING: ["MORE_INFO", "VOICE_PROPOSED", "ACCEPTED", "REJECTED", "CLOSED"],
  ACCEPTED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessStaffTools(actor.grade)) return Response.json({ error: "Accès réservé au staff." }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json().catch(() => null) as { status?: string; candidateMessage?: string; voiceSlots?: VoiceSlot[] } | null;
    if (!body) return Response.json({ error: "Requête invalide." }, { status: 400 });
    if (body.status && !RECRUITMENT_STATUSES.includes(body.status as never)) return Response.json({ error: "État invalide." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: current, error: currentError } = await admin.from("refgm_gm_applications").select("status, closed_from_status").eq("id", id).maybeSingle();
    if (currentError) return Response.json({ error: currentError.message }, { status: 500 });
    if (!current) return Response.json({ error: "Candidature introuvable." }, { status: 404 });
    if (body.status === "ACCEPTED" || body.status === "REJECTED") {
      const { count, error: voteCountError } = await admin
        .from("refgm_gm_application_votes")
        .select("id", { count: "exact", head: true })
        .eq("application_id", id)
        .neq("decision", "ABSTAIN");
      if (voteCountError) return Response.json({ error: voteCountError.message }, { status: 500 });
      if ((count ?? 0) < 2) return Response.json({ error: "Au moins 2 votes exprimÃ©s sont requis avant la dÃ©cision finale." }, { status: 409 });
    }
    if (body.status && body.status !== current.status && !(STATUS_TRANSITIONS[current.status] || []).includes(body.status)) return Response.json({ error: "Cette action n’est plus possible depuis l’état actuel de la candidature." }, { status: 409 });
    const rawSlots = Array.isArray(body.voiceSlots) ? body.voiceSlots.slice(0, 3) : undefined;
    const voiceSlots = rawSlots?.filter((slot) => slot.id && !Number.isNaN(Date.parse(slot.startsAt))).map((slot) => ({ id: String(slot.id).slice(0, 80), startsAt: new Date(slot.startsAt).toISOString(), note: String(slot.note || "").slice(0, 250) }));
    if (body.status === "VOICE_PROPOSED" && (!voiceSlots?.length || voiceSlots.length !== rawSlots?.length)) return Response.json({ error: "Ajoute au moins un créneau vocal valide." }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = body.status;
    if (body.status === "CLOSED") update.closed_from_status = current.status === "CLOSED" ? current.closed_from_status : current.status;
    if (typeof body.candidateMessage === "string") update.candidate_message = body.candidateMessage.trim().slice(0, 2000);
    if (voiceSlots) update.voice_slots = voiceSlots;
    const { data, error } = await admin.from("refgm_gm_applications").update(update).eq("id", id).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action: "recruitment.application_updated", entityType: "gm_application", entityId: id, metadata: { from: current.status, to: body.status || current.status, voiceSlots: voiceSlots?.length || 0, messageSent: typeof body.candidateMessage === "string" } });
    return Response.json({ application: data });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Mise à jour impossible." }, { status: 500 });
  }
}
