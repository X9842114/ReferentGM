import {
  requireApprovedActor,
} from "@/lib/server-authorization";
import { canAccessReferentHq } from "@/lib/permissions";
import { isCveBypassUser } from "@/lib/cve-access";
import {
  PRESENCE_STALE_MS,
  type ReferentPresencePeer,
} from "@/lib/referent-presence";

const KEY = "refgm.presence.v1";

function asMap(payload: unknown): Record<string, ReferentPresencePeer> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, ReferentPresencePeer>;
}

function prune(map: Record<string, ReferentPresencePeer>, now = Date.now()) {
  const next: Record<string, ReferentPresencePeer> = {};
  for (const peer of Object.values(map)) {
    if (!peer?.userId) continue;
    if (now - Number(peer.at || 0) > PRESENCE_STALE_MS) continue;
    next[peer.userId] = peer;
  }
  return next;
}

async function readMap() {
  const { sharedKvGet } = await import("@/lib/shared-kv");
  return prune(asMap(await sharedKvGet(KEY, {})));
}

async function writeMap(map: Record<string, ReferentPresencePeer>) {
  const { sharedKvSet } = await import("@/lib/shared-kv");
  await sharedKvSet(KEY, map);
}

export async function GET() {
  try {
    const actor = await requireApprovedActor();
    if (!isCveBypassUser(actor.userId) && !canAccessReferentHq(actor.grade)) {
      return Response.json({ peers: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const map = await readMap();
    return Response.json(
      { peers: Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "fr")) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ peers: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApprovedActor();
    if (!isCveBypassUser(actor.userId) && !canAccessReferentHq(actor.grade)) {
      return Response.json({ ok: false }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as {
      name?: string;
      avatarUrl?: string | null;
      path?: string;
    } | null;
    const map = await readMap();
    map[actor.userId] = {
      userId: actor.userId,
      name: String(body?.name || actor.displayName).trim().slice(0, 80) || actor.displayName,
      avatarUrl: body?.avatarUrl ? String(body.avatarUrl).slice(0, 500) : null,
      grade: actor.grade,
      path: String(body?.path || "/dashboard").slice(0, 180),
      at: Date.now(),
    };
    await writeMap(map);
    return Response.json({
      ok: true,
      peers: Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return Response.json({ ok: false, peers: [] }, { status: 200 });
  }
}
