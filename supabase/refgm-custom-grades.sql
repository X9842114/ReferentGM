-- RefGM — rôles personnalisés et permissions
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Ensuite, définir SUPABASE_SERVICE_ROLE_KEY uniquement dans les variables
-- serveur Vercel (jamais NEXT_PUBLIC_).

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

alter table public.refgm_grade_defs enable row level security;

drop policy if exists "refgm_grade_defs_public_read" on public.refgm_grade_defs;
create policy "refgm_grade_defs_public_read"
  on public.refgm_grade_defs for select using (true);

-- Aucune policy INSERT/UPDATE/DELETE : seul le service_role, utilisé par les
-- Route Handlers /api/grades, peut modifier les rôles.

