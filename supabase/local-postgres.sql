-- RefGM — schéma Postgres (local ou hébergé)
-- Appliquer : npm run db:setup
-- ou : psql -U postgres -d refgm -f supabase/local-postgres.sql

create table if not exists public.refgm_profiles (
  user_id text primary key,
  unique_id text not null default '',
  display_name text not null default 'Référent GM',
  bio text not null default '',
  banner_data_url text not null default '',
  discord_avatar_url text not null default '',
  discord_linked boolean not null default false,
  has_ig_perms boolean not null default false,
  accent text not null default '#38bdf8',
  updated_at timestamptz not null default now(),
  manual_badges jsonb not null default '[]'::jsonb
);

create table if not exists public.refgm_accounts (
  user_id text primary key,
  display_name text not null default 'Référent GM',
  discord_avatar_url text not null default '',
  discord_linked boolean not null default false,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  grade text not null default 'GAMEMASTER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by text null,
  reviewed_at timestamptz null
);

create table if not exists public.refgm_grade_defs (
  id text primary key,
  label text not null,
  rank integer not null,
  color text not null,
  kind text not null check (kind in ('REFERENT', 'GAMEMASTER', 'DEV')),
  is_system boolean not null default false,
  is_protected boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refgm_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists refgm_accounts_status_idx on public.refgm_accounts (status, created_at);
create index if not exists refgm_accounts_grade_idx on public.refgm_accounts (grade);
create index if not exists refgm_profiles_updated_at_idx on public.refgm_profiles (updated_at desc);
