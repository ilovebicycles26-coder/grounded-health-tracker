create table public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_on date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (char_length(unit) between 1 and 32),
  calories_kcal numeric(8, 1) not null check (calories_kcal between 0 and 10000),
  protein_g numeric(7, 1) check (protein_g between 0 and 1000),
  carbs_g numeric(7, 1) check (carbs_g between 0 and 2000),
  fat_g numeric(7, 1) check (fat_g between 0 and 1000),
  note text check (note is null or char_length(note) <= 240),
  revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, last_operation_id)
);

create table public.nutrition_targets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  calories_kcal numeric(8, 1) not null check (calories_kcal = 0 or calories_kcal between 1200 and 10000),
  protein_g numeric(7, 1) check (protein_g between 0 and 1000),
  carbs_g numeric(7, 1) check (carbs_g between 0 and 2000),
  fat_g numeric(7, 1) check (fat_g between 0 and 1000),
  revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_from),
  unique (user_id, last_operation_id)
);

create table public.food_favourites (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 10000),
  unit text not null check (char_length(unit) between 1 and 32),
  calories_kcal numeric(8, 1) not null check (calories_kcal between 0 and 10000),
  protein_g numeric(7, 1) check (protein_g between 0 and 1000),
  carbs_g numeric(7, 1) check (carbs_g between 0 and 2000),
  fat_g numeric(7, 1) check (fat_g between 0 and 1000),
  revision bigint not null default 1 check (revision > 0),
  last_operation_id uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, last_operation_id)
);

create index food_entries_user_date_active_idx on public.food_entries (user_id, consumed_on desc, id) where deleted_at is null;
create index food_entries_user_updated_idx on public.food_entries (user_id, updated_at, id);
create index nutrition_targets_user_effective_idx on public.nutrition_targets (user_id, effective_from desc) where deleted_at is null;
create index nutrition_targets_user_updated_idx on public.nutrition_targets (user_id, updated_at, id);
create index food_favourites_user_name_idx on public.food_favourites (user_id, lower(name)) where deleted_at is null;
create index food_favourites_user_updated_idx on public.food_favourites (user_id, updated_at, id);

create trigger food_entries_sync_metadata before insert or update on public.food_entries
for each row execute function private.enforce_health_record_sync_metadata();
create trigger nutrition_targets_sync_metadata before insert or update on public.nutrition_targets
for each row execute function private.enforce_health_record_sync_metadata();
create trigger food_favourites_sync_metadata before insert or update on public.food_favourites
for each row execute function private.enforce_health_record_sync_metadata();

alter table public.food_entries enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.food_favourites enable row level security;

revoke all on public.food_entries, public.nutrition_targets, public.food_favourites from anon, public;
grant select, insert, update on public.food_entries, public.nutrition_targets, public.food_favourites to authenticated;

create policy "food entries owner select" on public.food_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "food entries owner insert" on public.food_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "food entries owner update" on public.food_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "nutrition targets owner select" on public.nutrition_targets for select to authenticated using ((select auth.uid()) = user_id);
create policy "nutrition targets owner insert" on public.nutrition_targets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "nutrition targets owner update" on public.nutrition_targets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "food favourites owner select" on public.food_favourites for select to authenticated using ((select auth.uid()) = user_id);
create policy "food favourites owner insert" on public.food_favourites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "food favourites owner update" on public.food_favourites for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
