import { requireApprovedActor } from "@/lib/server-authorization";
import { canAccessLeadTools } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessLeadTools(actor.grade)) {
      return Response.json({ error: "Accès Lead requis." }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    const [state, accounts, audit] = await Promise.all([
      admin.from("refgm_shared_state").select("*").order("state_key"),
      admin.from("refgm_accounts").select("*").order("display_name"),
      admin
        .from("refgm_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    const error = state.error || accounts.error || audit.error;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const generatedAt = new Date().toISOString();
    return new Response(
      JSON.stringify(
        {
          format: "refgm-backup-v1",
          generatedAt,
          generatedBy: actor.userId,
          state: state.data,
          accounts: accounts.data,
          audit: audit.data,
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="refgm-backup-${generatedAt.slice(0, 10)}.json"`,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "Sauvegarde indisponible." }, { status: 503 });
  }
}

