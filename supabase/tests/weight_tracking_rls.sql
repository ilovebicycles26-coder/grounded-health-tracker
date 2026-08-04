begin;
select set_config('test.owner_id', (select id::text from auth.users order by created_at limit 1), true);
select set_config('test.other_id', (select id::text from auth.users order by created_at offset 1 limit 1), true);

insert into public.weight_entries (
  id, user_id, measured_on, weight_kg, last_operation_id
) values (
  '10000000-0000-0000-0000-000000000001',
  current_setting('test.other_id')::uuid,
  '2026-08-04',
  101.5,
  '20000000-0000-0000-0000-000000000001'
);

select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.weight_entries
    where user_id = current_setting('test.other_id')::uuid
  ) then
    raise exception 'Cross-account weight read succeeded';
  end if;
end;
$$;

insert into public.weight_entries (
  id, user_id, measured_on, weight_kg, last_operation_id
) values (
  '10000000-0000-0000-0000-000000000002',
  current_setting('test.owner_id')::uuid,
  '2026-08-04',
  108.4,
  '20000000-0000-0000-0000-000000000002'
);

update public.weight_entries
set weight_kg = 107.9,
    last_operation_id = '20000000-0000-0000-0000-000000000003'
where id = '10000000-0000-0000-0000-000000000002'
  and revision = 1;

do $$
begin
  if not exists (
    select 1 from public.weight_entries
    where id = '10000000-0000-0000-0000-000000000002'
      and revision = 2
      and weight_kg = 107.9
  ) then
    raise exception 'Owner revisioned update failed';
  end if;
end;
$$;

do $$
declare affected integer;
begin
  update public.weight_entries
  set weight_kg = 80
  where user_id = current_setting('test.other_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-account update changed % rows', affected;
  end if;
end;
$$;

rollback;
