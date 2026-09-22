import { requireApprovedActor } from "@/lib/server-authorization";
import { canAccessStaffTools } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Body = { title?: string; message?: string; href?: string };

export async function POST(request: Request) {
  try {
    const actor = await requireApprovedActor();
    if (!canAccessStaffTools(actor.grade)) {
      return Response.json({ error: "Accès staff requis." }, { status: 403 });
    }
    const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
    if (!webhook) {
      return Response.json(
        { error: "DISCORD_WEBHOOK_URL n’est pas configurée." },
        { status: 503 }
      );
    }
    const body = (await request.json().catch(() => null)) as Body | null;
    const title = body?.title?.trim().slice(0, 120);
    const message = body?.message?.trim().slice(0, 1800);
    if (!title || !message) {
      return Response.json({ error: "Titre et message requis." }, { status: 400 });
    }
    const href = body?.href?.trim();
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "RefGM",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title,
            description: message,
            url: href && /^https:\/\//.test(href) ? href : undefined,
            color: 0x7c3aed,
            footer: { text: `Envoyé par ${actor.displayName}` },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    if (!response.ok) {
      return Response.json({ error: "Discord a refusé le message." }, { status: 502 });
    }
    await getSupabaseAdmin().from("refgm_audit_log").insert({
      actor_id: actor.userId,
      actor_name: actor.displayName,
      action: "discord.notification.sent",
      entity_type: "discord",
      metadata: { title },
    });
    return Response.json({ ok: true });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ error: "Passerelle Discord indisponible." }, { status: 503 });
  }
}

