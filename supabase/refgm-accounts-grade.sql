-- RefGM — colonne grade sur refgm_accounts
-- À coller dans Supabase → SQL Editor (si la table existe déjà)

alter table public.refgm_accounts
  add column if not exists grade text not null default 'GAMEMASTER';

-- Contrainte douce : grades système connus (autoriser d’autres slugs custom plus tard)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'refgm_accounts_grade_check'
  ) then
    alter table public.refgm_accounts
      add constraint refgm_accounts_grade_check
      check (grade in (
        'DEVELOPPEUR',
        'SUPERVISEUR_GM',
        'LEAD_REFERENT',
        'CO_LEAD_REFERENT',
        'MANAGER_REFERENT',
        'REFERENT_QUALIFIE',
        'REFERENT',
        'GAMEMASTER'
      ));
  end if;
end $$;

create index if not exists refgm_accounts_grade_idx
  on public.refgm_accounts (grade);

notify pgrst, 'reload schema';
