import { requireApprovedActor } from "@/lib/server-authorization";
import { canAccessLeadTools } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";
import { canAccessStaffTools, canProposeMissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessLeadTools(actor.grade)) {
      return Response.json({ error: "Accès Lead requis." }, { status: 403 });
    }
    const limit = Math.min(
      500,
      Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 100)
    );
    const { data, error } = await getSupabaseAdmin()
      .from("refgm_audit_log")
      .select("id, actor_id, actor_name, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ entries: data ?? [] });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "Audit indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApprovedActor();
    const body = await request.json().catch(() => null) as { action?: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } | null;
    if (JSON.stringify(body || {}).length > 20_000) return Response.json({ error: "Journal trop volumineux." }, { status: 413 });
    const action = String(body?.action || "").slice(0, 120);
    const entityType = String(body?.entityType || "staff").slice(0, 80);
    if (!/^[a-z0-9_.-]{3,120}$/i.test(action)) return Response.json({ error: "Action invalide." }, { status: 400 });
    if (!canAccessStaffTools(actor.grade) && !(canProposeMissions(actor.grade) && action.startsWith("workshop."))) return Response.json({ error: "Action non autorisée." }, { status: 403 });
    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action, entityType, entityId: String(body?.entityId || "").slice(0, 120) || null, metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {} });
    return Response.json({ ok: true });
  } catch (cause) { return cause instanceof Response ? cause : Response.json({ error: "Journal indisponible." }, { status: 503 }); }
}

