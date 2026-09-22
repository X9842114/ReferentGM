import { canReadSharedKey, requireApprovedActor } from "@/lib/server-authorization";
import { SHARED_STORAGE_KEYS } from "@/lib/shared-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedActor();
    const revisionOnly = new URL(request.url).searchParams.get("revisions") === "1";
    const readableKeys = [...SHARED_STORAGE_KEYS].filter((key) => canReadSharedKey(actor, key));
    if (revisionOnly) {
      const { data, error } = await getSupabaseAdmin()
        .from("refgm_shared_state")
        .select("state_key, revision")
        .in("state_key", readableKeys);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(
        { revisions: Object.fromEntries((data ?? []).map((row: Record<string, unknown>) => [row.state_key, row.revision])) },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    const { data, error } = await getSupabaseAdmin()
      .from("refgm_shared_state")
      .select("state_key, payload, revision, updated_at, updated_by")
      .in("state_key", readableKeys);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({
      records: (data ?? []).map((row: Record<string, unknown>) => ({
        key: String(row.state_key || ""),
        payload: filterPayload(String(row.state_key || ""), row.payload, actor.userId),
        revision: row.revision,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "État partagé indisponible." }, { status: 503 });
  }
}

function filterPayload(key: string, payload: unknown, userId: string) {
  if (!Array.isArray(payload)) return payload;
  if (key === "refgm.notifications.v1") return payload.filter((row) => row && typeof row === "object" && String((row as Record<string, unknown>).userId || (row as Record<string, unknown>).user_id || "") === userId);
  if (key === "refgm.scene-workshops.v1") return payload.filter((row) => { if (!row || typeof row !== "object") return false; const value=row as Record<string, unknown>;return value.ownerId===userId || (Array.isArray(value.collaborators)&&value.collaborators.some((member)=>member&&typeof member==="object"&&(member as Record<string,unknown>).userId===userId)); });
  return payload;
}

