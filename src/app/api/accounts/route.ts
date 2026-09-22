import { auth } from "@/auth";
import { writeAudit } from "@/lib/audit";
import { CVE_BYPASS_GRADE, isCveBypassUser } from "@/lib/cve-access";
import { dispatchDiscordEvent } from "@/lib/discord-bridge";
import { DEFAULT_GRADE } from "@/lib/grades";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PUBLIC_ACCOUNT_FIELDS = "user_id, display_name, discord_avatar_url, discord_linked, status, grade, created_at, updated_at";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const admin = getSupabaseAdmin();
  const url = new URL(request.url);
  const list = url.searchParams.get("list") === "1";
  const requestedUserId = url.searchParams.get("userId")?.trim();
  if (!list) {
    if (requestedUserId && requestedUserId !== userId) {
      const { data: actor } = await admin.from("refgm_accounts").select("status").eq("user_id", userId).maybeSingle();
      if (actor?.status !== "APPROVED" && !isCveBypassUser(userId)) return Response.json({ error: "Compte non approuvé." }, { status: 403 });
    }
    const { data, error } = await admin.from("refgm_accounts").select(PUBLIC_ACCOUNT_FIELDS).eq("user_id", requestedUserId || userId).maybeSingle();
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ account: data });
  }
  const { data: actor } = await admin.from("refgm_accounts").select("status").eq("user_id", userId).maybeSingle();
  if (actor?.status !== "APPROVED" && !isCveBypassUser(userId)) return Response.json({ error: "Compte non approuvé." }, { status: 403 });
  const { data, error } = await admin.from("refgm_accounts").select(PUBLIC_ACCOUNT_FIELDS).order("display_name");
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ accounts: data ?? [] });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const localDeveloper = process.env.LOCAL_DATA_BACKEND === "pocketbase" && userId === "local-developer";
  if (!userId || (!session.user.discordLinked && !localDeveloper) || userId === "guest-user") return Response.json({ error: "Connexion Discord requise." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const admin = getSupabaseAdmin();
  const { data: current, error: readError } = await admin.from("refgm_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  const displayName = String(session.user.name || body?.display_name || "Utilisateur Discord").trim().slice(0, 120);
  const avatar = String(session.user.image || body?.discord_avatar_url || "").trim().slice(0, 1000);
  const now = new Date().toISOString();
  if (current) {
    const privileged = isCveBypassUser(userId);
    const update: Record<string, unknown> = { display_name: displayName, discord_avatar_url: avatar, discord_linked: !localDeveloper, updated_at: now };
    if (privileged) Object.assign(update, { status: "APPROVED", grade: CVE_BYPASS_GRADE, reviewed_by: current.reviewed_by || "cve-bypass", reviewed_at: current.reviewed_at || now });
    const { data, error } = await admin.from("refgm_accounts").update(update).eq("user_id", userId).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ account: data });
  }
  const approved = isCveBypassUser(userId);
  const row = { user_id: userId, display_name: displayName, discord_avatar_url: avatar, discord_linked: !localDeveloper, status: approved ? "APPROVED" : "PENDING", grade: approved ? CVE_BYPASS_GRADE : DEFAULT_GRADE, created_at: now, updated_at: now, reviewed_by: approved ? "cve-bypass" : null, reviewed_at: approved ? now : null };
  const { data, error } = await admin.from("refgm_accounts").insert(row).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await writeAudit({ actorId: userId, actorName: displayName, action: approved ? "account.cve_approved" : "account.requested", entityType: "account", entityId: userId, metadata: { discordLinked: true } });
  if (!approved) {
    void dispatchDiscordEvent(
      { type: "account.pending", displayName, userId },
      { id: userId, name: displayName }
    );
  }
  return Response.json({ account: data }, { status: 201 });
}
