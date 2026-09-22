import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function writeAudit(input: { actorId: string; actorName: string; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }) {
  try {
    await getSupabaseAdmin().from("refgm_audit_log").insert({
      actor_id: input.actorId,
      actor_name: input.actorName,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("[refgm:audit]", input.action, error);
  }
}
