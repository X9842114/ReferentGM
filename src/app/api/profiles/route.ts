import { writeAudit } from "@/lib/audit";
import { requireApprovedActor } from "@/lib/server-authorization";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createHash } from "node:crypto";

export async function GET(request: Request) {
  try {
    await requireApprovedActor();
    const userId = new URL(request.url).searchParams.get("userId")?.trim();
    let query = getSupabaseAdmin().from("refgm_profiles").select("*").order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ profiles: data ?? [] });
  } catch (error) { return error instanceof Response ? error : Response.json({ error: "Profils indisponibles." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApprovedActor();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Profil invalide." }, { status: 400 });
    let banner = String(body.banner_data_url || "");
    if (banner.length > 2_100_000 || (banner && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(banner) && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/refgm-profile-media\//i.test(banner) && !/^https:\/\/cdn\.discordapp\.com\/banners\/\d+\/[a-z0-9_]+\.(png|gif)(\?.*)?$/i.test(banner))) return Response.json({ error: "Bannière invalide ou trop lourde." }, { status: 400 });
    const admin = getSupabaseAdmin();
    if (banner.startsWith("data:image/") && process.env.LOCAL_DATA_BACKEND !== "pocketbase") {
      const match = banner.match(/^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/=]+)$/i);
      if (!match) return Response.json({ error: "Bannière invalide." }, { status: 400 });
      const extension = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > 1_500_000) return Response.json({ error: "Bannière invalide ou trop lourde." }, { status: 400 });
      const privateFolder = createHash("sha256").update(`refgm-profile:${actor.userId}`).digest("hex").slice(0, 32);
      const path = `${privateFolder}/banner.${extension}`;
      const { error: uploadError } = await admin.storage.from("refgm-profile-media").upload(path, bytes, { contentType: `image/${match[1].toLowerCase()}`, upsert: true, cacheControl: "3600" });
      if (uploadError) return Response.json({ error: `Stockage de la bannière impossible : ${uploadError.message}` }, { status: 500 });
      banner = `${admin.storage.from("refgm-profile-media").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    }
    const accent = String(body.accent || "#38bdf8");
    const decoration = String(body.discord_decoration_url || "").trim().slice(0, 1000);
    const discordAccent = String(body.discord_accent_color || "").trim();
    const row = { user_id: actor.userId, unique_id: String(body.unique_id || actor.userId).slice(0, 80), display_name: String(body.display_name || actor.displayName).trim().slice(0, 120), bio: String(body.bio || "").trim().slice(0, 2000), banner_data_url: banner, discord_avatar_url: String(body.discord_avatar_url || "").slice(0, 1000), discord_decoration_url: /^https:\/\/cdn\.discordapp\.com\/avatar-decoration-presets\//i.test(decoration) ? decoration : "", discord_accent_color: /^#[0-9a-f]{6}$/i.test(discordAccent) ? discordAccent : "", discord_linked: true, has_ig_perms: body.has_ig_perms === true, accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#38bdf8", updated_at: new Date().toISOString() };
    let { data, error } = await admin.from("refgm_profiles").upsert(row, { onConflict: "user_id" }).select("*").single();
    if (error && /discord_(decoration_url|accent_color)/i.test(error.message)) {
      const { discord_decoration_url: _decoration, discord_accent_color: _discordAccent, ...legacyRow } = row;
      void _decoration;
      void _discordAccent;
      ({ data, error } = await admin.from("refgm_profiles").upsert(legacyRow, { onConflict: "user_id" }).select("*").single());
    }
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await writeAudit({ actorId: actor.userId, actorName: actor.displayName, action: "profile.updated", entityType: "profile", entityId: actor.userId });
    return Response.json({ profile: data });
  } catch (error) { return error instanceof Response ? error : Response.json({ error: "Enregistrement impossible." }, { status: 503 }); }
}
