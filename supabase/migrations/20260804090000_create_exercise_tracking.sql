create table public.exercise_routines (
  id uuid primary key, family_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  estimated_minutes integer not null check (estimated_minutes between 1 and 1440), version integer not null check (version > 0),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 30),
  revision bigint not null default 1 check (revision > 0), last_operation_id uuid not null, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, family_id, version), unique (user_id, last_operation_id)
);
create table public.workout_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.exercise_routines(id) on delete set null,
  routine_name text not null check (char_length(routine_name) between 1 and 100),
  activity_type text not null check (activity_type in ('cycling','kettlebell','bodyweight','resistance_band','mobility','hula_hoop','walking','custom')),
  completed_at timestamptz not null, duration_minutes integer not null check (duration_minutes between 1 and 1440),
  perceived_effort integer check (perceived_effort between 1 and 10), note text check (note is null or char_length(note) <= 500),
  revision bigint not null default 1 check (revision > 0), last_operation_id uuid not null, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, last_operation_id)
);
create table public.exercise_preferences (
  id uuid primary key, user_id uuid not null unique references auth.users(id) on delete cascade,
  activities text[] not null check (cardinality(activities) between 1 and 8), days_per_week integer not null check (days_per_week between 1 and 7),
  session_minutes integer not null check (session_minutes between 10 and 240), revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, last_operation_id)
);
create index exercise_routines_user_updated_idx on public.exercise_routines(user_id, updated_at, id);
create index exercise_routines_user_active_idx on public.exercise_routines(user_id, updated_at desc) where deleted_at is null;
create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc, id) where deleted_at is null;
create index workout_sessions_user_updated_idx on public.workout_sessions(user_id, updated_at, id);
create index exercise_preferences_user_updated_idx on public.exercise_preferences(user_id, updated_at, id);
create trigger exercise_routines_sync_metadata before insert or update on public.exercise_routines for each row execute function private.enforce_health_record_sync_metadata();
create trigger workout_sessions_sync_metadata before insert or update on public.workout_sessions for each row execute function private.enforce_health_record_sync_metadata();
create trigger exercise_preferences_sync_metadata before insert or update on public.exercise_preferences for each row execute function private.enforce_health_record_sync_metadata();
alter table public.exercise_routines enable row level security; alter table public.workout_sessions enable row level security; alter table public.exercise_preferences enable row level security;
revoke all on public.exercise_routines, public.workout_sessions, public.exercise_preferences from anon, public;
grant select, insert, update on public.exercise_routines, public.workout_sessions, public.exercise_preferences to authenticated;
create policy "exercise routines owner select" on public.exercise_routines for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercise routines owner insert" on public.exercise_routines for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercise routines owner update" on public.exercise_routines for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout sessions owner select" on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout sessions owner insert" on public.workout_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workout sessions owner update" on public.workout_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exercise preferences owner select" on public.exercise_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercise preferences owner insert" on public.exercise_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercise preferences owner update" on public.exercise_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
