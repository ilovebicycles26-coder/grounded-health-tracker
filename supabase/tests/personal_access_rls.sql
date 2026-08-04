begin;
select plan(9);

select is(
  (select count(*) from private.personal_testers),
  2::bigint,
  'the personal allowlist contains exactly Richard and Zoe'
);

select set_config('test.allowed_id', (select user_id::text from private.personal_testers order by added_at, user_id limit 1), true);
select set_config('test.outsider_id', '00000000-0000-0000-0000-000000000099', true);
set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('test.allowed_id'), true);
select ok(public.has_personal_access(), 'an allowlisted account passes the application gate');
select is((select count(*) from public.profiles), 1::bigint, 'an allowlisted account can read its own profile');

select set_config('request.jwt.claim.sub', current_setting('test.outsider_id'), true);
select is(public.has_personal_access(), false, 'an unlisted account fails the application gate');
select is((select count(*) from public.profiles), 0::bigint, 'an unlisted account cannot read profiles');
select is((select count(*) from public.weight_entries), 0::bigint, 'an unlisted account cannot read weight data');
select is((select count(*) from public.food_entries), 0::bigint, 'an unlisted account cannot read nutrition data');
select is((select count(*) from public.wellbeing_checkins), 0::bigint, 'an unlisted account cannot read wellbeing data');
select is((select count(*) from public.health_states), 0::bigint, 'an unlisted account cannot read legacy prototype health data');

select * from finish();
rollback;
