import { canAccessStaffTools } from "@/lib/permissions";
import { requireApprovedActor } from "@/lib/server-authorization";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessStaffTools(actor.grade)) return Response.json({ error: "Accès réservé au staff." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const sinceValue = new URL(request.url).searchParams.get("since");
    const since = sinceValue && Number.isFinite(Date.parse(sinceValue))
      ? new Date(sinceValue).toISOString()
      : null;
    let applicationsQuery = admin.from("refgm_gm_applications").select("*").neq("status", "DRAFT").order("submitted_at", { ascending: false });
    let votesQuery = admin.from("refgm_gm_application_votes").select("*").order("created_at", { ascending: true });
    let historyQuery = admin.from("refgm_gm_application_history").select("*").order("archived_at", { ascending: false });
    if (since) {
      applicationsQuery = applicationsQuery.gte("updated_at", since);
      votesQuery = votesQuery.gte("updated_at", since);
      historyQuery = historyQuery.gte("archived_at", since);
    }
    const [{ data: applications, error }, { data: votes, error: votesError }, { data: history, error: historyError }] = await Promise.all([
      applicationsQuery,
      votesQuery,
      historyQuery,
    ]);
    if (error || votesError || historyError) return Response.json({ error: error?.message || votesError?.message || historyError?.message }, { status: 500 });
    return Response.json({ applications, votes, history, actorId: actor.userId, syncAt: new Date().toISOString(), delta: Boolean(since) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) return Response.json({ error: "Configuration Supabase manquante sur Vercel : ajoute SUPABASE_SERVICE_ROLE_KEY au projet refgm-eu." }, { status: 503 });
    return Response.json({ error: "Impossible de charger les candidatures. Réessaie dans quelques instants." }, { status: 500 });
  }
}
