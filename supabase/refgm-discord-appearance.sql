-- Apparence Discord des profils RefGM.
-- À exécuter une fois dans Supabase > SQL Editor.
alter table public.refgm_profiles
  add column if not exists discord_decoration_url text not null default '';

alter table public.refgm_profiles
  add column if not exists discord_accent_color text not null default '';

notify pgrst, 'reload schema';
