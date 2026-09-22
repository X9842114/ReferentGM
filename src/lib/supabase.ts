import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Les tables RefGM sont en service_role only. Le navigateur passe par les API Next.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  return null;
}

/** Évite que les pages restent bloquées si Supabase ne répond pas. */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 2000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("supabase-timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
}

export type RefgmProfileRow = {
  user_id: string;
  unique_id: string;
  display_name: string;
  bio: string;
  banner_data_url: string;
  discord_avatar_url: string;
  discord_linked: boolean;
  has_ig_perms: boolean;
  accent: string;
  updated_at: string;
  manual_badges?: string[] | null;
};
