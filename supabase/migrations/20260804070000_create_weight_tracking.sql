create table public.weight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6, 3) not null check (weight_kg between 25 and 500),
  note text null check (note is null or char_length(note) <= 240),
  revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, last_operation_id)
);

comment on table public.weight_entries is
  'Private canonical-kilogram weight observations with revisioned local-first sync metadata.';

create index weight_entries_user_date_idx
on public.weight_entries (user_id, measured_on desc)
where deleted_at is null;

create index weight_entries_user_updated_idx
on public.weight_entries (user_id, updated_at, id);

create table public.weight_goals (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  target_weight_kg numeric(6, 3) not null check (target_weight_kg between 25 and 500),
  target_date date null,
  revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, last_operation_id)
);

comment on table public.weight_goals is
  'One private weight goal per account with revisioned local-first sync metadata.';

create index weight_goals_user_updated_idx
on public.weight_goals (user_id, updated_at, id);

create function private.enforce_health_record_sync_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.revision = 1;
    new.created_at = now();
    new.updated_at = now();
  else
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'Health record ownership and identity are immutable';
    end if;
    new.revision = old.revision + 1;
    new.created_at = old.created_at;
    new.updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_health_record_sync_metadata() from public, anon, authenticated;

create trigger weight_entries_sync_metadata
before insert or update on public.weight_entries
for each row execute function private.enforce_health_record_sync_metadata();

create trigger weight_goals_sync_metadata
before insert or update on public.weight_goals
for each row execute function private.enforce_health_record_sync_metadata();

alter table public.weight_entries enable row level security;
alter table public.weight_goals enable row level security;

revoke all on table public.weight_entries from anon, authenticated;
revoke all on table public.weight_goals from anon, authenticated;
grant select, insert, update on table public.weight_entries to authenticated;
grant select, insert, update on table public.weight_goals to authenticated;

create policy weight_entries_select_own
on public.weight_entries
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy weight_entries_insert_own
on public.weight_entries
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy weight_entries_update_own
on public.weight_entries
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy weight_goals_select_own
on public.weight_goals
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy weight_goals_insert_own
on public.weight_goals
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy weight_goals_update_own
on public.weight_goals
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
