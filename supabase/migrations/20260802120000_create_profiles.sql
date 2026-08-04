create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text null check (display_name is null or char_length(display_name) between 1 and 80),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  locale text not null default 'en-GB' check (char_length(locale) between 2 and 16),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Private per-user product preferences; authorization is enforced by RLS.';

alter table public.profiles enable row level security;

grant select, insert, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

create trigger create_profile_after_user_signup
after insert on auth.users
for each row execute function private.create_profile_for_new_user();

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
