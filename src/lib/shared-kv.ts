import "server-only";

import { ensureDb, kvAll, kvGet, kvMerge, kvSet } from "@/lib/local-db";
import { getSupabaseAdmin, hasRemoteSupabaseAdmin } from "@/lib/supabase-admin";

export async function sharedKvAll(): Promise<Record<string, unknown>> {
  if (hasRemoteSupabaseAdmin()) {
    const admin = getSupabaseAdmin();
    const [{ data, error }, shared] = await Promise.all([
      admin.from("refgm_kv").select("key, value"),
      admin.from("refgm_shared_state").select("state_key, payload"),
    ]);
    if (error) throw new Error(error.message);
    const out: Record<string, unknown> = {};
    for (const row of shared.data ?? []) {
      if (typeof row.state_key === "string" && row.state_key !== "refgm.presence.v1") {
        out[row.state_key] = row.payload;
      }
    }
    for (const row of data ?? []) {
      if (typeof row.key !== "string") continue;
      if (row.key === "refgm.presence.v1") continue;
      out[row.key] = row.value;
    }
    return out;
  }
  await ensureDb();
  return kvAll();
}

export async function sharedKvStamp(): Promise<string> {
  if (hasRemoteSupabaseAdmin()) {
    const { data, error } = await getSupabaseAdmin()
      .from("refgm_kv")
      .select("updated_at")
      .neq("key", "refgm.presence.v1")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return typeof data?.updated_at === "string" ? data.updated_at : "";
  }
  await ensureDb();
  return String(Object.keys(await kvAll()).length);
}

export async function sharedKvGet<T>(key: string, fallback: T): Promise<T> {
  if (hasRemoteSupabaseAdmin()) {
    const { data, error } = await getSupabaseAdmin()
      .from("refgm_kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value === undefined ? fallback : (data.value as T);
  }
  await ensureDb();
  return kvGet(key, fallback);
}

export async function sharedKvSet(key: string, value: unknown) {
  if (hasRemoteSupabaseAdmin()) {
    const { error } = await getSupabaseAdmin()
      .from("refgm_kv")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) throw new Error(error.message);
    return;
  }
  await kvSet(key, value);
}

export async function sharedKvMerge(entries: Record<string, unknown>) {
  if (hasRemoteSupabaseAdmin()) {
    const now = new Date().toISOString();
    const rows = Object.entries(entries)
      .filter(([key]) => key.startsWith("refgm."))
      .map(([key, value]) => ({
        key,
        value,
        updated_at: now,
      }));
    if (rows.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from("refgm_kv")
      .upsert(rows, { onConflict: "key" });
    if (!error) return;
    for (const row of rows) {
      await sharedKvSet(row.key, row.value);
    }
    return;
  }
  await kvMerge(entries);
}
