-- RefGM — correctif de sécurité prioritaire
-- À exécuter dans Supabase SQL Editor après les scripts d'installation.

begin;

delete from public.refgm_accounts where user_id = 'guest-user';

alter table public.refgm_accounts enable row level security;
drop policy if exists "refgm_accounts_select" on public.refgm_accounts;
drop policy if exists "refgm_accounts_insert" on public.refgm_accounts;
drop policy if exists "refgm_accounts_update" on public.refgm_accounts;
drop policy if exists "refgm_accounts_delete" on public.refgm_accounts;
revoke all on public.refgm_accounts from anon, authenticated;
grant all on public.refgm_accounts to service_role;

alter table public.refgm_profiles enable row level security;
drop policy if exists "refgm_profiles_select" on public.refgm_profiles;
drop policy if exists "refgm_profiles_insert" on public.refgm_profiles;
drop policy if exists "refgm_profiles_update" on public.refgm_profiles;
drop policy if exists "refgm_profiles_delete" on public.refgm_profiles;
revoke all on public.refgm_profiles from anon, authenticated;
grant all on public.refgm_profiles to service_role;

alter table public.refgm_shared_state enable row level security;
alter table public.refgm_audit_log enable row level security;
revoke all on public.refgm_shared_state from anon, authenticated;
revoke all on public.refgm_audit_log from anon, authenticated;
grant all on public.refgm_shared_state to service_role;
grant all on public.refgm_audit_log to service_role;

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
revoke all on function public.refgm_put_shared_state(text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.refgm_put_shared_state(text, jsonb, bigint, text) to service_role;

commit;
notify pgrst, 'reload schema';
