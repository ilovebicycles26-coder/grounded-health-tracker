begin;
select plan(6);

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_user_id', true);

select lives_ok(
  format($sql$insert into public.food_entries (id, user_id, consumed_on, meal_type, name, quantity, unit, calories_kcal, last_operation_id) values (%L, %L, '2026-08-04', 'dinner', 'RLS test meal', 1, 'serving', 500, %L)$sql$, gen_random_uuid(), :'owner_user_id', gen_random_uuid()),
  'owner can insert a food entry'
);
select is((select count(*) from public.food_entries where user_id = :'owner_user_id'), 1::bigint, 'owner sees own entry');

select set_config('request.jwt.claim.sub', :'other_user_id', true);
select is((select count(*) from public.food_entries where user_id = :'owner_user_id'), 0::bigint, 'another account cannot see entry');
select is((with changed as (update public.food_entries set name = 'changed' where user_id = :'owner_user_id' returning 1) select count(*) from changed), 0::bigint, 'another account cannot update entry');
select is((select count(*) from public.nutrition_targets where user_id = :'owner_user_id'), 0::bigint, 'targets are isolated');
select is((select count(*) from public.food_favourites where user_id = :'owner_user_id'), 0::bigint, 'favourites are isolated');

select * from finish();
rollback;
