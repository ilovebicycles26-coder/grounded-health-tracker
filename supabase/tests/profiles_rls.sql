begin;
select set_config('test.owner_id', (select id::text from auth.users order by created_at limit 1), true);
select set_config('test.other_id', (select id::text from auth.users order by created_at offset 1 limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$ begin if (select count(*) from public.profiles) <> 1 then raise exception 'RLS isolation failed'; end if; end; $$;
do $$ declare affected integer; begin update public.profiles set display_name = 'cross-user-write-must-fail' where user_id = current_setting('test.other_id')::uuid; get diagnostics affected = row_count; if affected <> 0 then raise exception 'Cross-user update changed % rows', affected; end if; end; $$;
update public.profiles
set unit_system = 'imperial', week_starts_on = 0, calorie_display = false, analytics_consent = true
where user_id = current_setting('test.owner_id')::uuid;
do $$ begin if not exists (
  select 1 from public.profiles
  where user_id = current_setting('test.owner_id')::uuid
    and unit_system = 'imperial'
    and week_starts_on = 0
    and calorie_display = false
    and analytics_consent = true
) then raise exception 'Owner settings update failed'; end if; end; $$;
rollback;
