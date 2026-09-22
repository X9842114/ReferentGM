import { auth } from "@/auth";
import { requireApprovedActor } from "@/lib/server-authorization";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  try {
    const [actor, session] = await Promise.all([requireApprovedActor(), auth()]);
    const banner = session?.user?.discordBannerUrl || "";
    const decoration = session?.user?.discordDecorationUrl || "";
    const discordAccent = session?.user?.discordAccent || "";
    const avatar = session?.user?.image || "";
    if (!banner && !decoration && !avatar) return Response.json({ synced: false });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from("refgm_profiles").select("*").eq("user_id", actor.userId).maybeSingle();
    const row = {
      user_id: actor.userId,
      unique_id: actor.userId,
      display_name: actor.displayName,
      bio: existing?.bio || "",
      banner_data_url: banner || existing?.banner_data_url || "",
      discord_avatar_url: avatar || existing?.discord_avatar_url || "",
      discord_decoration_url: decoration,
      discord_accent_color: discordAccent,
      discord_linked: true,
      has_ig_perms: existing?.has_ig_perms === true,
      accent: existing?.accent || discordAccent || "#a1a1aa",
      updated_at: new Date().toISOString(),
    };

    let { error } = await admin.from("refgm_profiles").upsert(row, { onConflict: "user_id" });
    if (error && /discord_(decoration_url|accent_color)/i.test(error.message)) {
      const { discord_decoration_url: _decoration, discord_accent_color: _accent, ...legacyRow } = row;
      void _decoration;
      void _accent;
      ({ error } = await admin.from("refgm_profiles").upsert(legacyRow, { onConflict: "user_id" }));
    }
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ synced: true });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Synchronisation Discord impossible." }, { status: 503 });
  }
}
