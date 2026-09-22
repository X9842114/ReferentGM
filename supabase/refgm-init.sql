-- RefGM — profils référents (à coller dans Supabase → SQL Editor)
-- Projet: pnovpnhorbvpdwsdmxtp

create table if not exists public.refgm_profiles (
  user_id text primary key,
  unique_id text not null,
  display_name text not null default 'Référent GM',
  bio text not null default '',
  banner_data_url text not null default '',
  discord_avatar_url text not null default '',
  discord_linked boolean not null default false,
  has_ig_perms boolean not null default false,
  accent text not null default '#38bdf8',
  updated_at timestamptz not null default now()
);

alter table public.refgm_profiles
  add column if not exists manual_badges jsonb not null default '[]'::jsonb;

create index if not exists refgm_profiles_updated_at_idx
  on public.refgm_profiles (updated_at desc);

alter table public.refgm_profiles enable row level security;

-- Auth.js (pas Supabase Auth) → accès via clé publishable (anon)
drop policy if exists "refgm_profiles_select" on public.refgm_profiles;
create policy "refgm_profiles_select"
  on public.refgm_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "refgm_profiles_insert" on public.refgm_profiles;
create policy "refgm_profiles_insert"
  on public.refgm_profiles
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "refgm_profiles_update" on public.refgm_profiles;
create policy "refgm_profiles_update"
  on public.refgm_profiles
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "refgm_profiles_delete" on public.refgm_profiles;
create policy "refgm_profiles_delete"
  on public.refgm_profiles
  for delete
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';

-- Comptes RefGM (validation référent)
create table if not exists public.refgm_accounts (
  user_id text primary key,
  display_name text not null default 'Référent GM',
  discord_avatar_url text not null default '',
  discord_linked boolean not null default false,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  grade text not null default 'GAMEMASTER'
    check (grade in (
      'DEVELOPPEUR',
      'SUPERVISEUR_GM',
      'LEAD_REFERENT',
      'CO_LEAD_REFERENT',
      'MANAGER_REFERENT',
      'REFERENT_QUALIFIE',
      'REFERENT',
      'GAMEMASTER'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by text null,
  reviewed_at timestamptz null
);

create index if not exists refgm_accounts_status_idx
  on public.refgm_accounts (status, created_at);

create index if not exists refgm_accounts_grade_idx
  on public.refgm_accounts (grade);

alter table public.refgm_accounts enable row level security;

drop policy if exists "refgm_accounts_select" on public.refgm_accounts;
create policy "refgm_accounts_select"
  on public.refgm_accounts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "refgm_accounts_insert" on public.refgm_accounts;
create policy "refgm_accounts_insert"
  on public.refgm_accounts
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "refgm_accounts_update" on public.refgm_accounts;
create policy "refgm_accounts_update"
  on public.refgm_accounts
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "refgm_accounts_delete" on public.refgm_accounts;
create policy "refgm_accounts_delete"
  on public.refgm_accounts
  for delete
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
