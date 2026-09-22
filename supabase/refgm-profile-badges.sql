-- Badges manuels (Staff / Modérateur) sur refgm_profiles
alter table public.refgm_profiles
  add column if not exists manual_badges jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
