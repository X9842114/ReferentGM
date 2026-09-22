-- RefGM — recrutement GameMaster

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
  status text not null default 'DRAFT' check (status in (
    'DRAFT','SUBMITTED','ANALYZING','STAFF_REVIEW','MORE_INFO',
    'VOICE_PROPOSED','DECISION_PENDING','ACCEPTED','REJECTED','CLOSED'
  )),
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
  add column if not exists closed_from_status text;

alter table public.refgm_gm_applications
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

-- Une candidature fermée peut être recommencée sans perdre son ancien dossier.
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

alter table public.refgm_gm_applications enable row level security;
alter table public.refgm_gm_application_votes enable row level security;
alter table public.refgm_gm_application_history enable row level security;
revoke all on public.refgm_gm_applications from anon, authenticated;
revoke all on public.refgm_gm_application_votes from anon, authenticated;
revoke all on public.refgm_gm_application_history from anon, authenticated;
grant all on public.refgm_gm_applications to service_role;
grant all on public.refgm_gm_application_votes to service_role;
grant all on public.refgm_gm_application_history to service_role;
