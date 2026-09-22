import { fetchDiscordUser } from "@/lib/discord-rest";

const DISCORD_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "cdn.discord.com",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await fetchDiscordUser(id);
  if (!user?.avatarUrl) {
    return new Response("Not found", { status: 404 });
  }

  let target: URL;
  try {
    target = new URL(user.avatarUrl);
  } catch {
    return new Response("Bad avatar", { status: 502 });
  }
  if (!DISCORD_HOSTS.has(target.hostname)) {
    return new Response("Blocked host", { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    cache: "force-cache",
    headers: { Accept: "image/*" },
  });
  if (!upstream.ok || !upstream.body) {
    return Response.redirect(target.toString(), 302);
  }

  const contentType = upstream.headers.get("content-type") || "image/png";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
