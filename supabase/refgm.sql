-- RefGM — tout le schéma, UN SEUL script
-- Supabase → SQL Editor → coller tout → Run
-- Relançable : ne casse pas les données existantes.

-- ========== Comptes ==========
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

alter table public.refgm_accounts
  add column if not exists grade text not null default 'GAMEMASTER';
alter table public.refgm_accounts
  drop constraint if exists refgm_accounts_grade_check;

create index if not exists refgm_accounts_status_idx
  on public.refgm_accounts (status, created_at);
create index if not exists refgm_accounts_grade_idx
  on public.refgm_accounts (grade);

-- ========== Profils ==========
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
  manual_badges jsonb not null default '[]'::jsonb,
  discord_decoration_url text not null default '',
  discord_accent_color text not null default ''
);

alter table public.refgm_profiles
  add column if not exists unique_id text not null default '';
alter table public.refgm_profiles
  add column if not exists manual_badges jsonb not null default '[]'::jsonb;
alter table public.refgm_profiles
  add column if not exists discord_decoration_url text not null default '';
alter table public.refgm_profiles
  add column if not exists discord_accent_color text not null default '';

create index if not exists refgm_profiles_updated_at_idx
  on public.refgm_profiles (updated_at desc);

-- ========== Grades ==========
create table if not exists public.refgm_grade_defs (
  id text primary key check (id ~ '^[A-Z][A-Z0-9_]{2,47}$'),
  label text not null check (char_length(label) between 1 and 80),
  rank integer not null check (rank between -1 and 999),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text not null check (kind in ('REFERENT', 'GAMEMASTER', 'DEV')),
  is_system boolean not null default false,
  is_protected boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.refgm_grade_defs
  (id, label, rank, color, kind, is_system, is_protected, permissions)
values
  ('DEVELOPPEUR', 'Développeur', -1, '#a78bfa', 'DEV', true, true,
   '{"manageGrades":true,"accessMissions":true,"readMissions":true,"giveRewards":true,"accessRewards":true,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":true,"demoteSuperviseur":true}'),
  ('SUPERVISEUR_GM', 'Superviseur GameMaster', 1, '#f59e0b', 'REFERENT', true, true,
   '{"manageGrades":true,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":true,"demoteSuperviseur":false}'),
  ('LEAD_REFERENT', 'Lead Référent GameMaster', 2, '#fbbf24', 'REFERENT', true, false,
   '{"manageGrades":true,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":false,"demoteSuperviseur":false}'),
  ('CO_LEAD_REFERENT', 'Co Lead Référent GameMaster', 3, '#fcd34d', 'REFERENT', true, false,
   '{"manageGrades":true,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":false,"demoteSuperviseur":false}'),
  ('MANAGER_REFERENT', 'Manager Référent GameMaster', 4, '#38bdf8', 'REFERENT', true, false,
   '{"manageGrades":false,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":false,"demoteSuperviseur":false}'),
  ('REFERENT_QUALIFIE', 'Référent GameMaster Qualifié', 5, '#34d399', 'REFERENT', true, false,
   '{"manageGrades":false,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":false,"demoteSuperviseur":false}'),
  ('REFERENT', 'Référent GameMaster', 6, '#2dd4bf', 'REFERENT', true, false,
   '{"manageGrades":false,"accessMissions":true,"readMissions":true,"giveRewards":false,"accessRewards":false,"manageGroups":true,"browseGroups":true,"staffTools":true,"viewProfiles":true,"verifyAccounts":true,"configureApp":false,"demoteSuperviseur":false}'),
  ('GAMEMASTER', 'GameMaster', 7, '#fb923c', 'GAMEMASTER', true, false,
   '{"manageGrades":false,"accessMissions":true,"readMissions":false,"giveRewards":true,"accessRewards":true,"manageGroups":false,"browseGroups":true,"staffTools":false,"viewProfiles":true,"verifyAccounts":false,"configureApp":false,"demoteSuperviseur":false}')
on conflict (id) do nothing;

-- ========== Clé-valeur (missions, suivi, etc.) ==========
create table if not exists public.refgm_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ========== État partagé + audit ==========
create table if not exists public.refgm_shared_state (
  state_key text primary key,
  payload jsonb not null default 'null'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by text not null references public.refgm_accounts(user_id)
);

create table if not exists public.refgm_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id text references public.refgm_accounts(user_id),
  actor_name text not null default 'Système',
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists refgm_audit_log_created_idx
  on public.refgm_audit_log (created_at desc);
create index if not exists refgm_audit_log_entity_idx
  on public.refgm_audit_log (entity_type, entity_id);

-- ========== Recrutement GM ==========
create table if not exists public.refgm_gm_applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  discord_name text not null,
  discord_avatar_url text not null default '',
  first_name text not null default '',
  age integer check (age between 13 and 99),
  unique_id text not null default '',
  experience text not null default '',
  motivation text not null default '',
  availability text not null default '',
  document_url text not null default '',
  trame_summary text not null default '',
  status text not null default 'DRAFT',
  analysis jsonb,
  candidate_message text,
  closed_from_status text,
  voice_slots jsonb not null default '[]'::jsonb,
  selected_voice_slot_id text,
  integration_availability text not null default '',
  personal_introduction text not null default '',
  legal_rp_experience text not null default '',
  illegal_rp_experience text not null default '',
  servers_visited text not null default '',
  rp_storylines text not null default '',
  gm_missions text not null default '',
  rp_events text not null default '',
  suggestions text not null default '',
  why_gm text not null default '',
  qualities text not null default '',
  long_term_contribution text not null default '',
  staff_experience text not null default '',
  additional_information text not null default '',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.refgm_gm_applications
  add column if not exists integration_availability text not null default '',
  add column if not exists closed_from_status text,
  add column if not exists personal_introduction text not null default '',
  add column if not exists legal_rp_experience text not null default '',
  add column if not exists illegal_rp_experience text not null default '',
  add column if not exists servers_visited text not null default '',
  add column if not exists rp_storylines text not null default '',
  add column if not exists gm_missions text not null default '',
  add column if not exists rp_events text not null default '',
  add column if not exists suggestions text not null default '',
  add column if not exists why_gm text not null default '',
  add column if not exists qualities text not null default '',
  add column if not exists long_term_contribution text not null default '',
  add column if not exists staff_experience text not null default '',
  add column if not exists additional_information text not null default '';

alter table public.refgm_gm_applications
  drop constraint if exists refgm_gm_applications_status_check;
alter table public.refgm_gm_applications
  add constraint refgm_gm_applications_status_check check (status in (
    'DRAFT','SUBMITTED','ANALYZING','STAFF_REVIEW','MORE_INFO',
    'VOICE_PROPOSED','DECISION_PENDING','ACCEPTED','REJECTED','CLOSED'
  ));

create table if not exists public.refgm_gm_application_votes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.refgm_gm_applications(id) on delete cascade,
  voter_id text not null references public.refgm_accounts(user_id),
  voter_name text not null,
  decision text not null check (decision in ('FAVORABLE','CONDITIONAL','MORE_INFO','UNFAVORABLE','ABSTAIN')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, voter_id)
);

create table if not exists public.refgm_gm_application_history (
  id uuid primary key default gen_random_uuid(),
  original_application_id uuid not null,
  user_id text not null,
  attempt_number integer not null default 1,
  final_status text not null,
  closed_from_status text,
  candidate_message text,
  application_snapshot jsonb not null,
  votes_snapshot jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz not null default now()
);

create index if not exists refgm_gm_applications_status_idx
  on public.refgm_gm_applications(status, updated_at desc);
create index if not exists refgm_gm_application_votes_application_idx
  on public.refgm_gm_application_votes(application_id);
create index if not exists refgm_gm_application_history_user_idx
  on public.refgm_gm_application_history(user_id, archived_at desc);

create table if not exists public.refgm_schema_version (
  version integer primary key,
  label text not null,
  installed_at timestamptz not null default now()
);

-- ========== Sécurité (écritures via le serveur, pas le navigateur) ==========
delete from public.refgm_accounts where user_id = 'guest-user';

alter table public.refgm_accounts enable row level security;
alter table public.refgm_profiles enable row level security;
alter table public.refgm_grade_defs enable row level security;
alter table public.refgm_kv enable row level security;
alter table public.refgm_shared_state enable row level security;
alter table public.refgm_audit_log enable row level security;
alter table public.refgm_gm_applications enable row level security;
alter table public.refgm_gm_application_votes enable row level security;
alter table public.refgm_gm_application_history enable row level security;

drop policy if exists "refgm_accounts_select" on public.refgm_accounts;
drop policy if exists "refgm_accounts_insert" on public.refgm_accounts;
drop policy if exists "refgm_accounts_update" on public.refgm_accounts;
drop policy if exists "refgm_accounts_delete" on public.refgm_accounts;
drop policy if exists "refgm_profiles_select" on public.refgm_profiles;
drop policy if exists "refgm_profiles_insert" on public.refgm_profiles;
drop policy if exists "refgm_profiles_update" on public.refgm_profiles;
drop policy if exists "refgm_profiles_delete" on public.refgm_profiles;
drop policy if exists "refgm_grade_defs_public_read" on public.refgm_grade_defs;

revoke all on public.refgm_accounts from anon, authenticated;
revoke all on public.refgm_profiles from anon, authenticated;
revoke all on public.refgm_grade_defs from anon, authenticated;
revoke all on public.refgm_kv from anon, authenticated;
revoke all on public.refgm_shared_state from anon, authenticated;
revoke all on public.refgm_audit_log from anon, authenticated;
revoke all on public.refgm_gm_applications from anon, authenticated;
revoke all on public.refgm_gm_application_votes from anon, authenticated;
revoke all on public.refgm_gm_application_history from anon, authenticated;

grant all on public.refgm_accounts to service_role;
grant all on public.refgm_profiles to service_role;
grant all on public.refgm_grade_defs to service_role;
grant all on public.refgm_kv to service_role;
grant all on public.refgm_shared_state to service_role;
grant all on public.refgm_audit_log to service_role;
grant all on public.refgm_gm_applications to service_role;
grant all on public.refgm_gm_application_votes to service_role;
grant all on public.refgm_gm_application_history to service_role;

create or replace function public.refgm_put_shared_state(
  p_key text, p_payload jsonb, p_expected_revision bigint, p_actor text
)
returns setof public.refgm_shared_state
language plpgsql security definer set search_path = public as $$
declare current_revision bigint;
begin
  select revision into current_revision from public.refgm_shared_state where state_key = p_key for update;
  current_revision := coalesce(current_revision, 0);
  if p_expected_revision is not null and p_expected_revision <> current_revision then
    raise exception 'revision_conflict' using errcode = 'P0001';
  end if;
  insert into public.refgm_shared_state(state_key, payload, revision, updated_at, updated_by)
  values (p_key, p_payload, current_revision + 1, now(), p_actor)
  on conflict (state_key) do update
    set payload = excluded.payload,
        revision = excluded.revision,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  return query select * from public.refgm_shared_state where state_key = p_key;
end $$;

create or replace function public.refgm_set_recruitment_settings(p_payload jsonb, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.refgm_shared_state(state_key, payload, revision, updated_at, updated_by)
  values ('refgm.recruitment.settings.v1', p_payload, 1, now(), p_actor)
  on conflict (state_key) do update
    set payload = excluded.payload,
        revision = public.refgm_shared_state.revision + 1,
        updated_at = now(),
        updated_by = p_actor;
end $$;

revoke all on function public.refgm_put_shared_state(text, jsonb, bigint, text)
  from public, anon, authenticated;
revoke all on function public.refgm_set_recruitment_settings(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.refgm_put_shared_state(text, jsonb, bigint, text) to service_role;
grant execute on function public.refgm_set_recruitment_settings(jsonb, text) to service_role;

-- ========== Storage bannières (si Supabase Storage existe) ==========
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'refgm-profile-media',
      'refgm-profile-media',
      true,
      1500000,
      array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    )
    on conflict (id) do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ========== Realtime ==========
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'refgm_shared_state'
     )
  then
    alter publication supabase_realtime add table public.refgm_shared_state;
  end if;
end $$;

insert into public.refgm_schema_version(version, label)
values (20260917, 'refgm.sql unique')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
