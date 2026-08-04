-- Grounded is a two-person personal app. This allowlist is the outer
-- authorization boundary; existing owner and sharing policies remain the
-- inner boundary between the two accounts.
create table private.personal_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

revoke all on table private.personal_testers from public, anon, authenticated;

-- Richard and Zoe were deliberately provisioned before this migration. Seed
-- those accounts without storing generated IDs in source control and fail
-- atomically if this is not the expected two-person environment.
do $$
declare
  existing_user_count integer;
begin
  select count(*) into existing_user_count from auth.users;
  if existing_user_count <> 2 then
    raise exception 'Expected exactly two existing Grounded users, found %', existing_user_count;
  end if;

  insert into private.personal_testers (user_id)
  select id from auth.users;
end;
$$;

create function private.is_personal_tester(candidate_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate_user_id is not null
    and exists (
      select 1
      from private.personal_testers tester
      where tester.user_id = candidate_user_id
    )
$$;

revoke all on function private.is_personal_tester(uuid) from public, anon, authenticated;
grant execute on function private.is_personal_tester(uuid) to authenticated;

create function public.has_personal_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_personal_tester((select auth.uid()))
$$;

revoke all on function public.has_personal_access() from public, anon;
grant execute on function public.has_personal_access() to authenticated;

-- Ready to select in Authentication > Hooks as a Before User Created hook.
-- Database authorization remains effective before that dashboard switch.
create function public.reject_new_grounded_user(event jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'New accounts are closed for this personal Grounded app.'
    )
  )
$$;

revoke all on function public.reject_new_grounded_user(jsonb)
  from public, anon, authenticated;
grant execute on function public.reject_new_grounded_user(jsonb) to supabase_auth_admin;

-- Restrictive policies are ANDed with every existing owner/share policy.
create policy "personal testers only" on public.profiles
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.weight_entries
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.weight_goals
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.food_entries
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.nutrition_targets
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.food_favourites
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.exercise_routines
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.workout_sessions
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.exercise_preferences
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.habit_definitions
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.habit_completions
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.wellbeing_checkins
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.partnerships
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.partner_invites
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));
create policy "personal testers only" on public.sharing_grants
  as restrictive for all to authenticated
  using ((select private.is_personal_tester((select auth.uid()))))
  with check ((select private.is_personal_tester((select auth.uid()))));

-- SECURITY DEFINER sharing functions bypass RLS, so enforce the allowlist at
-- their explicit trust boundary as well.
create or replace function public.create_partner_invite()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare invite_code text;
begin
  if not private.is_personal_tester((select auth.uid())) then
    raise exception 'personal_access_required';
  end if;
  invite_code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  insert into public.partner_invites(created_by, code_hash, expires_at)
  values ((select auth.uid()), encode(extensions.digest(invite_code, 'sha256'), 'hex'), now() + interval '7 days');
  return invite_code;
end
$$;

create or replace function public.accept_partner_invite(invite_code text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare invite public.partner_invites; partnership_id uuid;
begin
  if not private.is_personal_tester((select auth.uid())) then
    raise exception 'personal_access_required';
  end if;
  select * into invite from public.partner_invites
  where code_hash = encode(extensions.digest(upper(trim(invite_code)), 'sha256'), 'hex')
    and accepted_at is null and expires_at > now() for update;
  if invite.id is null
    or invite.created_by = (select auth.uid())
    or not private.is_personal_tester(invite.created_by) then
    raise exception 'invalid_invite';
  end if;
  insert into public.partnerships(user_a, user_b)
  values (least(invite.created_by, (select auth.uid())), greatest(invite.created_by, (select auth.uid())))
  on conflict(user_a, user_b) do update set status = 'active', ended_at = null
  returning id into partnership_id;
  update public.partner_invites set accepted_by = (select auth.uid()), accepted_at = now()
  where id = invite.id;
  return partnership_id;
end
$$;

create or replace function public.list_my_partners()
returns table(partnership_id uuid, partner_user_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id,
    case when p.user_a = (select auth.uid()) then p.user_b else p.user_a end,
    coalesce(pr.display_name, 'Partner')
  from public.partnerships p
  left join public.profiles pr
    on pr.user_id = case when p.user_a = (select auth.uid()) then p.user_b else p.user_a end
  where private.is_personal_tester((select auth.uid()))
    and private.is_personal_tester(
      case when p.user_a = (select auth.uid()) then p.user_b else p.user_a end
    )
    and p.status = 'active'
    and (select auth.uid()) in (p.user_a, p.user_b)
$$;

create or replace function public.get_shared_weight_summary(target_user uuid)
returns table(current_weight_kg numeric, first_weight_kg numeric, target_weight_kg numeric, last_measured_on date)
language sql stable security definer set search_path = '' as $$
  select current_entry.weight_kg, first_entry.weight_kg, goal.target_weight_kg, current_entry.measured_on
  from lateral (
    select w.weight_kg, w.measured_on from public.weight_entries w
    where w.user_id = target_user and w.deleted_at is null
    order by w.measured_on desc, w.created_at desc limit 1
  ) current_entry
  cross join lateral (
    select w.weight_kg from public.weight_entries w
    where w.user_id = target_user and w.deleted_at is null
    order by w.measured_on, w.created_at limit 1
  ) first_entry
  left join lateral (
    select g.target_weight_kg from public.weight_goals g
    where g.user_id = target_user and g.deleted_at is null limit 1
  ) goal on true
  where private.is_personal_tester((select auth.uid()))
    and private.is_personal_tester(target_user)
    and private.can_access_shared_resource(target_user, (select auth.uid()), 'weight_progress')
$$;
