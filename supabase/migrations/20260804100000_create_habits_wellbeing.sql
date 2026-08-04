create table public.habit_definitions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, name text not null check(char_length(name) between 1 and 100),
 category text not null check(category in ('supplements','hydration','sleep','movement','mindfulness','custom')),
 weekdays smallint[] not null check(cardinality(weekdays) between 1 and 7), reminder_time time,
 revision bigint not null default 1 check(revision>0), last_operation_id uuid not null, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,last_operation_id)
);
create table public.habit_completions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 habit_id uuid not null references public.habit_definitions(id) on delete cascade, completed_on date not null,
 revision bigint not null default 1 check(revision>0), last_operation_id uuid not null, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,habit_id,completed_on), unique(user_id,last_operation_id)
);
create table public.wellbeing_checkins (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, checked_on date not null,
 mood smallint not null check(mood between 1 and 5), energy smallint not null check(energy between 1 and 5), sleep_quality smallint not null check(sleep_quality between 1 and 5),
 note text check(note is null or char_length(note)<=500), revision bigint not null default 1 check(revision>0), last_operation_id uuid not null,
 deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,checked_on), unique(user_id,last_operation_id)
);
create index habit_definitions_user_updated_idx on public.habit_definitions(user_id,updated_at,id);
create index habit_completions_user_date_idx on public.habit_completions(user_id,completed_on desc,habit_id) where deleted_at is null;
create index habit_completions_user_updated_idx on public.habit_completions(user_id,updated_at,id);
create index wellbeing_checkins_user_date_idx on public.wellbeing_checkins(user_id,checked_on desc) where deleted_at is null;
create index wellbeing_checkins_user_updated_idx on public.wellbeing_checkins(user_id,updated_at,id);
create trigger habit_definitions_sync_metadata before insert or update on public.habit_definitions for each row execute function private.enforce_health_record_sync_metadata();
create trigger habit_completions_sync_metadata before insert or update on public.habit_completions for each row execute function private.enforce_health_record_sync_metadata();
create trigger wellbeing_checkins_sync_metadata before insert or update on public.wellbeing_checkins for each row execute function private.enforce_health_record_sync_metadata();
alter table public.habit_definitions enable row level security; alter table public.habit_completions enable row level security; alter table public.wellbeing_checkins enable row level security;
revoke all on public.habit_definitions,public.habit_completions,public.wellbeing_checkins from anon,public;
grant select,insert,update on public.habit_definitions,public.habit_completions,public.wellbeing_checkins to authenticated;
create policy "habit definitions owner select" on public.habit_definitions for select to authenticated using((select auth.uid())=user_id);
create policy "habit definitions owner insert" on public.habit_definitions for insert to authenticated with check((select auth.uid())=user_id);
create policy "habit definitions owner update" on public.habit_definitions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "habit completions owner select" on public.habit_completions for select to authenticated using((select auth.uid())=user_id);
create policy "habit completions owner insert" on public.habit_completions for insert to authenticated with check((select auth.uid())=user_id);
create policy "habit completions owner update" on public.habit_completions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "wellbeing checkins owner select" on public.wellbeing_checkins for select to authenticated using((select auth.uid())=user_id);
create policy "wellbeing checkins owner insert" on public.wellbeing_checkins for insert to authenticated with check((select auth.uid())=user_id);
create policy "wellbeing checkins owner update" on public.wellbeing_checkins for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
