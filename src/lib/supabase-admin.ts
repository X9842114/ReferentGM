import { createClient } from "@supabase/supabase-js";
import { createLocalSupabase, isLocalSupabaseUrl } from "@/lib/local-supabase";

function serviceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  ).trim();
}

function isCloudSupabaseUrl(url?: string | null) {
  const value = url?.trim() ?? "";
  if (!value) return false;
  if (value.includes("localhost") || value.includes("127.0.0.1")) return false;
  return value.includes("supabase.co");
}

export function hasRemoteSupabaseAdmin() {
  return isCloudSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(serviceRoleKey());
}

/**
 * Client réservé aux Route Handlers. Cette clé ne doit jamais commencer par
 * NEXT_PUBLIC_ ni être importée dans un composant client.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = serviceRoleKey();

  if (url && key && isCloudSupabaseUrl(url)) {
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    });
  }

  if (isLocalSupabaseUrl(url)) {
    return createLocalSupabase() as unknown as ReturnType<typeof createClient>;
  }

  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY manquant : les écritures d’administration sont désactivées."
  );
}
