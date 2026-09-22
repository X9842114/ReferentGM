import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const RECRUITMENT_SETTINGS_KEY = "refgm.recruitment.settings.v1";

export type RecruitmentSettings = {
  open: boolean;
  message: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const DEFAULT_RECRUITMENT_SETTINGS: RecruitmentSettings = {
  open: true,
  message: "Les recrutements GameMaster sont actuellement fermés. Reviens prochainement pour déposer ta candidature.",
  updatedAt: null,
  updatedBy: null,
};

export async function getRecruitmentSettings(): Promise<RecruitmentSettings> {
  const admin = getSupabaseAdmin();
  const fromState = await admin
    .from("refgm_shared_state")
    .select("payload, updated_at, updated_by")
    .eq("state_key", RECRUITMENT_SETTINGS_KEY)
    .maybeSingle();
  const fromKv = await admin
    .from("refgm_kv")
    .select("value, updated_at")
    .eq("key", RECRUITMENT_SETTINGS_KEY)
    .maybeSingle();
  const payload = (fromState.data?.payload ?? fromKv.data?.value ?? {}) as Partial<RecruitmentSettings>;
  if (!fromState.data && !fromKv.data) return DEFAULT_RECRUITMENT_SETTINGS;
  return {
    open: payload.open !== false,
    message: String(payload.message || DEFAULT_RECRUITMENT_SETTINGS.message).slice(0, 500),
    updatedAt: fromState.data?.updated_at ?? fromKv.data?.updated_at ?? null,
    updatedBy: fromState.data?.updated_by ?? null,
  };
}

export async function saveRecruitmentSettings(input: { open: boolean; message: string; actorId: string }) {
  const now = new Date().toISOString();
  const payload = { open: input.open, message: input.message.trim().slice(0, 500) || DEFAULT_RECRUITMENT_SETTINGS.message };
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("refgm_set_recruitment_settings", { p_payload: payload, p_actor: input.actorId });
  if (error) {
    // Compatibilité temporaire avant l'exécution de refgm-final-upgrade.sql.
    if (!/refgm_set_recruitment_settings|schema cache|function/i.test(error.message)) throw new Error(error.message);
    const current = await admin.from("refgm_shared_state").select("revision").eq("state_key", RECRUITMENT_SETTINGS_KEY).maybeSingle();
    const fallback = await admin.from("refgm_shared_state").upsert({ state_key: RECRUITMENT_SETTINGS_KEY, payload, revision: (current.data?.revision ?? 0) + 1, updated_at: now, updated_by: input.actorId });
    if (fallback.error) {
      const kv = await admin.from("refgm_kv").upsert(
        { key: RECRUITMENT_SETTINGS_KEY, value: payload, updated_at: now },
        { onConflict: "key" }
      );
      if (kv.error) throw new Error(kv.error.message);
    }
  }
  return { ...payload, updatedAt: now, updatedBy: input.actorId } satisfies RecruitmentSettings;
}
