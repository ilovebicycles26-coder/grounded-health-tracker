# Product requirements

Status: Milestone 0 baseline  
Owner: Product and Engineering  
Market assumption: United Kingdom first  
Launch order: responsive web/PWA beta, iOS and Android native release, desktop later

## Product promise

Grounded helps people understand and improve their long-term health through calm, private tracking. It must favour sustainable behaviour and useful trends over guilt, streak pressure, or medical claims.

## Primary users

### Individual

An adult tracking weight, food, exercise, habits, and wellbeing for personal use. They own every health record they create.

### Invited partner

An adult with a separate account and separate private health record. Partners may share selected categories with one another through explicit, revocable permissions. Joining a household never grants automatic access to health data.

### Support operator — future

An authorised employee who can assist with account-level problems but cannot browse health records by default. Any exceptional access requires a separate audited support workflow.

## Release principles

1. Each person has an independent profile and data boundary.
2. Private by default; sharing is granular, explicit, visible, and revocable.
3. Offline entries are first-class and synchronise safely later.
4. Calculations explain their inputs and never present themselves as diagnoses.
5. Core workflows work with keyboard, screen reader, large text, reduced motion, and small touchscreens.
6. Users can export and delete their data without contacting support.
7. Health values and free-text notes never enter analytics or routine logs.

## First commercial release scope

### Account and identity

- Email/password registration, confirmation, recovery, sign-in, durable or session-only sign-in, and sign-out.
- One person per account; no shared credentials.
- Profile, timezone, locale, units, consent, and communication preferences.
- Account switching cannot leak cached data between users.

### Today dashboard

- Personal summary for weight trend, nutrition, planned movement, habits, and wellbeing.
- Clear offline/sync state.
- Empty states that guide rather than pressure.
- Module visibility can be customised.

### Weight

- Goal and start weight.
- Add, edit, and delete dated measurements.
- Kilogram and stone/pound presentation without losing canonical precision.
- Trend chart, rolling average option, milestones, notes, and CSV export.
- No promise of a safe rate or target date without an appropriate reviewed policy.

### Nutrition

- Food diary by date and meal.
- Calories and optional macro targets.
- Add, edit, copy, favourite, and delete entries.
- Daily and weekly summaries.
- Manual food entry first; barcode/product database is later scope.
- Targets are user-provided unless a separately reviewed calculation feature is introduced.

### Exercise

- Editable, versioned routine templates.
- Cycling, kettlebell, bodyweight, resistance-band mobility, hula hooping, walking, dancing, and custom activities.
- Record partial or complete sessions.
- Historical sessions preserve what was actually performed when templates change.
- Safety language is general and non-diagnostic.

### Habits and wellbeing

- Flexible schedules, completion history, archive, and reminders.
- Mood, energy, sleep, and optional private notes.
- Streaks can be hidden; missed days do not use punitive language.

### Sharing

- Invite and accept flow.
- Category-level permission choices: summary, weight trend, routines, food plan, habits, or none.
- Private notes remain excluded unless a later purpose-specific grant is designed.
- Review screen explains exactly what each person can see.
- Revocation takes effect at the database boundary and on active clients.

### Data rights

- Versioned machine-readable export and per-module CSV.
- Account deletion with confirmation, grace period, and clear shared-data consequences.
- Import preview and conflict report before writes.

## Explicitly out of first release

- Diagnosis, treatment, medication dosing, or clinician decision support.
- Automated calorie targets presented as medical advice.
- Child accounts.
- Public profiles, social feeds, competitions, or public leaderboards.
- Advertising or sale of health data.
- Third-party executable plugins.
- Wearables, HealthKit, Health Connect, and barcode databases until core data quality is proven.
- Desktop packaging until the web client is stable.

## Non-functional requirements

### Reliability

- No confirmed local write is lost during ordinary offline use, restart, or reconnection.
- Sync operations are idempotent.
- Schema migrations are forward-only, tested, and recoverable through backups.
- Production database backups and restore drills have owners and evidence.

### Performance budgets

- Web LCP p75 under 2.5 seconds on a representative mid-range mobile device and 4G connection.
- INP p75 under 200 ms and CLS under 0.1.
- Authenticated shell usable within 3 seconds when local data exists.
- Adding a local entry gives visible confirmation within 100 ms.
- Histories of 10,000 entries remain navigable through pagination/virtualisation.

### Security and privacy

- RLS isolation tests for every exposed table.
- No service credentials in clients.
- Sensitive values excluded from telemetry.
- Dependency, secret, and static security scanning in CI.
- Rate limits and abuse controls for authentication, invitations, exports, and destructive actions.

### Compatibility

- Current and previous major Safari, Chrome, Edge, and Firefox releases for web.
- Supported iOS and Android versions follow current Expo policy and are recorded per release.
- Responsive from 320 CSS pixels to large desktop layouts.

## Success measures

Only privacy-safe aggregate events are eligible:

- Registration and confirmation completion rate.
- First useful entry completion rate by module, without recording values.
- Seven- and thirty-day return rate.
- Sync success and recovery rate.
- Crash-free sessions.
- Sharing invitation completion and revocation success.
- Export/deletion completion.
- Accessibility defects and support contacts per release.

## Product assumptions requiring validation

- Adults only for initial launch.
- UK is the first commercial market.
- Web/PWA beta precedes app-store launch.
- Partners want selective visibility, not a combined health profile.
- Manual food tracking provides value before a licensed food database.
- Users prefer sustainable, non-judgemental guidance over competitive mechanics.

These assumptions must be tested through research before commercial launch; changing one may require an architecture decision record.
