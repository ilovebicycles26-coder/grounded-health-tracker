alter table public.profiles
  add column week_starts_on smallint not null default 1,
  add column calorie_display boolean not null default true,
  add column analytics_consent boolean not null default false;

alter table public.profiles
  add constraint profiles_week_starts_on_check check (week_starts_on in (0, 1));

comment on column public.profiles.week_starts_on is
  'Account calendar preference: 0 for Sunday, 1 for Monday.';
comment on column public.profiles.calorie_display is
  'Whether calorie totals are shown in nutrition surfaces.';
comment on column public.profiles.analytics_consent is
  'Explicit opt-in for privacy-safe product analytics; false means no consent.';
