-- RefGM — mise à niveau consolidée du 12 août 2026
-- À exécuter UNE FOIS dans Supabase > SQL Editor après les anciens scripts.
-- Le script peut être relancé sans supprimer les données existantes.

begin;

create table if not exists public.refgm_schema_version (
  version integer primary key,
  label text not null,
  installed_at timestamptz not null default now()
);

alter table if exists public.refgm_gm_applications
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

create index if not exists refgm_gm_application_history_user_idx on public.refgm_gm_application_history(user_id, archived_at desc);
create index if not exists refgm_audit_log_created_idx on public.refgm_audit_log(created_at desc);
create index if not exists refgm_audit_log_entity_idx on public.refgm_audit_log(entity_type, entity_id);

alter table public.refgm_gm_applications enable row level security;
alter table public.refgm_gm_application_votes enable row level security;
alter table public.refgm_gm_application_history enable row level security;
alter table public.refgm_shared_state enable row level security;
alter table public.refgm_audit_log enable row level security;

revoke all on public.refgm_gm_applications, public.refgm_gm_application_votes, public.refgm_gm_application_history, public.refgm_shared_state, public.refgm_audit_log from anon, authenticated;
grant all on public.refgm_gm_applications, public.refgm_gm_application_votes, public.refgm_gm_application_history, public.refgm_shared_state, public.refgm_audit_log to service_role;

create or replace function public.refgm_put_shared_state(p_key text, p_payload jsonb, p_expected_revision bigint, p_actor text)
returns setof public.refgm_shared_state language plpgsql security definer set search_path = public as $$
declare current_revision bigint;
begin
  select revision into current_revision from public.refgm_shared_state where state_key = p_key for update;
  current_revision := coalesce(current_revision, 0);
  if p_expected_revision is not null and p_expected_revision <> current_revision then raise exception 'revision_conflict' using errcode = 'P0001'; end if;
  insert into public.refgm_shared_state(state_key, payload, revision, updated_at, updated_by)
  values (p_key, p_payload, current_revision + 1, now(), p_actor)
  on conflict (state_key) do update set payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return query select * from public.refgm_shared_state where state_key = p_key;
end $$;

create or replace function public.refgm_set_recruitment_settings(p_payload jsonb, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.refgm_shared_state(state_key, payload, revision, updated_at, updated_by)
  values ('refgm.recruitment.settings.v1', p_payload, 1, now(), p_actor)
  on conflict (state_key) do update set payload = excluded.payload, revision = public.refgm_shared_state.revision + 1, updated_at = now(), updated_by = p_actor;
end $$;

revoke all on function public.refgm_put_shared_state(text, jsonb, bigint, text) from public, anon, authenticated;
revoke all on function public.refgm_set_recruitment_settings(jsonb, text) from public, anon, authenticated;
grant execute on function public.refgm_put_shared_state(text, jsonb, bigint, text) to service_role;
grant execute on function public.refgm_set_recruitment_settings(jsonb, text) to service_role;

insert into public.refgm_schema_version(version, label) values (20260812, 'security-sync-recruitment') on conflict (version) do nothing;

commit;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'refgm_shared_state'
  ) then alter publication supabase_realtime add table public.refgm_shared_state; end if;
end $$;

notify pgrst, 'reload schema';
