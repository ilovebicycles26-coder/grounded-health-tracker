-- Cover foreign keys used for joins and cascading deletes.
create index habit_completions_habit_id_idx
  on public.habit_completions(habit_id);
create index partner_invites_accepted_by_idx
  on public.partner_invites(accepted_by)
  where accepted_by is not null;
create index workout_sessions_routine_id_idx
  on public.workout_sessions(routine_id)
  where routine_id is not null;

-- Expose only caller-bound helpers to authenticated RLS evaluation. The broader
-- helpers remain available to trusted SECURITY DEFINER RPC implementations.
create function private.current_user_has_active_partnership(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.has_active_partnership((select auth.uid()), other_user)
$$;

create function private.current_user_can_access_shared_resource(
  owner_id uuid,
  requested_resource text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.can_access_shared_resource(
      owner_id,
      (select auth.uid()),
      requested_resource
    )
$$;

revoke all on function private.current_user_has_active_partnership(uuid),
  private.current_user_can_access_shared_resource(uuid,text)
  from public, anon, authenticated;
grant execute on function private.current_user_has_active_partnership(uuid),
  private.current_user_can_access_shared_resource(uuid,text)
  to authenticated;
revoke execute on function private.has_active_partnership(uuid,uuid),
  private.can_access_shared_resource(uuid,uuid,text)
  from authenticated;

drop policy "sharing owner insert" on public.sharing_grants;
drop policy "sharing owner update" on public.sharing_grants;
create policy "sharing owner insert" on public.sharing_grants
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and (select private.current_user_has_active_partnership(recipient_user_id))
  );
create policy "sharing owner update" on public.sharing_grants
  for update to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check (
    (select auth.uid()) = owner_user_id
    and (select private.current_user_has_active_partnership(recipient_user_id))
  );

-- One permissive SELECT policy per table avoids evaluating multiple policy
-- branches while preserving owner access and explicit, revocable sharing.
drop policy "exercise routines owner select" on public.exercise_routines;
drop policy "shared routines select" on public.exercise_routines;
create policy "exercise routines authorised select" on public.exercise_routines
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_can_access_shared_resource(user_id, 'routine_library'))
  );

drop policy "habit definitions owner select" on public.habit_definitions;
drop policy "shared habit definitions select" on public.habit_definitions;
create policy "habit definitions authorised select" on public.habit_definitions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_can_access_shared_resource(user_id, 'habit_progress'))
  );

drop policy "habit completions owner select" on public.habit_completions;
drop policy "shared habit completions select" on public.habit_completions;
create policy "habit completions authorised select" on public.habit_completions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.current_user_can_access_shared_resource(user_id, 'habit_progress'))
  );
