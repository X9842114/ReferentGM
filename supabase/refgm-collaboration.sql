-- RefGM collaboration foundation
-- Run after supabase/refgm-full-setup.sql.

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

alter table public.refgm_shared_state enable row level security;
alter table public.refgm_audit_log enable row level security;

-- All browser writes go through authenticated Next.js route handlers using
-- the service role. No anonymous or direct authenticated writes are allowed.
revoke all on public.refgm_shared_state from anon, authenticated;
revoke all on public.refgm_audit_log from anon, authenticated;
grant all on public.refgm_shared_state to service_role;
grant all on public.refgm_audit_log to service_role;

alter publication supabase_realtime add table public.refgm_shared_state;

