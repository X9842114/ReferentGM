import {
  canReadSharedKey,
  canWriteSharedKey,
  jsonAuthError,
  requireApprovedAccount,
} from "@/lib/server-authorization";
import { sanitizeSharedPayload } from "@/lib/sanitize-rich-html";
import { sharedKvAll, sharedKvMerge, sharedKvSet, sharedKvStamp } from "@/lib/shared-kv";

const MAX_VALUE_BYTES = 1_000_000;
const MAX_ENTRIES = 80;

function tooBig(value: unknown) {
  try {
    return JSON.stringify(value).length > MAX_VALUE_BYTES;
  } catch {
    return true;
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireApprovedAccount();
    const stampOnly = new URL(request.url).searchParams.get("stamp") === "1";
    if (stampOnly) {
      return Response.json(
        { stamp: await sharedKvStamp() },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    const dump = await sharedKvAll();
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dump)) {
      if (canReadSharedKey(actor, key)) filtered[key] = value;
    }
    return Response.json(filtered, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof Response) return jsonAuthError(error);
    const message =
      error instanceof Error ? error.message : "Lecture impossible.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireApprovedAccount();
    const body = (await request.json().catch(() => null)) as
      | { key?: string; value?: unknown; entries?: Record<string, unknown> }
      | null;

    const incoming =
      body?.entries && typeof body.entries === "object"
        ? body.entries
        : body?.key
          ? { [body.key]: body.value }
          : null;
    if (!incoming || Object.keys(incoming).length === 0) {
      return Response.json({ error: "Clé manquante." }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    let denied = 0;
    for (const [key, value] of Object.entries(incoming)) {
      if (!key.startsWith("refgm.") || !canWriteSharedKey(actor, key)) {
        denied += 1;
        continue;
      }
      if (tooBig(value)) {
        return Response.json(
          { error: "Données trop volumineuses (1 Mo maximum)." },
          { status: 413 }
        );
      }
      allowed[key] = sanitizeSharedPayload(key, value);
    }

    const keys = Object.keys(allowed);
    if (keys.length === 0) {
      return Response.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    if (keys.length > MAX_ENTRIES) {
      return Response.json({ error: "Trop de clés d’un coup." }, { status: 413 });
    }

    if (keys.length === 1) {
      const key = keys[0];
      await sharedKvSet(key, allowed[key]);
    } else {
      await sharedKvMerge(allowed);
    }
    return Response.json({ ok: true, written: keys.length, skipped: denied });
  } catch (error) {
    if (error instanceof Response) return jsonAuthError(error);
    const message =
      error instanceof Error ? error.message : "Écriture impossible.";
    return Response.json({ error: message }, { status: 500 });
  }
}
