-- The original prototype tables share this Supabase project. Keep them behind
-- the same two-person boundary so an obsolete RPC cannot become a side door.
create policy "personal testers only" on public.households
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.household_members
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.health_states
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.user_health_states
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_personal_tester((select auth.uid()))
    and exists (
      select 1 from public.household_members
      where household_id = target_household
        and user_id = (select auth.uid())
    )
$$;

create or replace function public.create_household(household_name text)
returns table(household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid; new_code text;
begin
  if not private.is_personal_tester((select auth.uid())) then
    raise exception 'personal_access_required';
  end if;
  if exists (
    select 1 from public.household_members where user_id = (select auth.uid())
  ) then
    raise exception 'You already belong to a household';
  end if;
  insert into public.households(name, created_by)
  values (trim(household_name), (select auth.uid()))
  returning id, households.invite_code into new_id, new_code;
  insert into public.household_members(household_id, user_id, role)
  values (new_id, (select auth.uid()), 'owner');
  insert into public.health_states(household_id, data, updated_by)
  values (new_id, '{}'::jsonb, (select auth.uid()));
  return query select new_id, new_code;
end
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
begin
  if not private.is_personal_tester((select auth.uid())) then
    raise exception 'personal_access_required';
  end if;
  if exists (
    select 1 from public.household_members where user_id = (select auth.uid())
  ) then
    raise exception 'You already belong to a household';
  end if;
  select id into target_id from public.households
  where invite_code = upper(trim(code));
  if target_id is null then
    raise exception 'Invite code not found';
  end if;
  insert into public.household_members(household_id, user_id, role)
  values (target_id, (select auth.uid()), 'member');
  return target_id;
end
$$;

create or replace function public.my_household()
returns table(household_id uuid, household_name text, invite_code text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, h.invite_code, m.role
  from public.household_members m
  join public.households h on h.id = m.household_id
  where private.is_personal_tester((select auth.uid()))
    and m.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.is_household_member(uuid),
  public.create_household(text), public.join_household(text),
  public.my_household() from public, anon, authenticated;
grant execute on function public.is_household_member(uuid),
  public.create_household(text), public.join_household(text),
  public.my_household() to authenticated;
