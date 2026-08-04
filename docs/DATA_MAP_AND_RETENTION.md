# Data map and retention baseline

Status: Engineering baseline; requires legal/privacy review before commercial launch.

## Classification levels

- **Restricted health:** weight, food, calories, exercise, habits, wellbeing, goals, notes.
- **Confidential identity:** email, user ID, household membership, sharing grants, support correspondence.
- **Operational:** device type, app version, sync status, safe error codes, audit actions.
- **Public:** published legal text and generic routine templates expressly marked public.

## Data inventory

| Category       | Examples                                         | Purpose                    | Store                        | Default access                           | Proposed retention                                  |
| -------------- | ------------------------------------------------ | -------------------------- | ---------------------------- | ---------------------------------------- | --------------------------------------------------- |
| Identity       | email, auth ID, verification state               | Account access             | Supabase Auth                | Account owner; limited auth operators    | Account life + deletion grace/audit requirement     |
| Profile        | display name, timezone, units                    | Personalisation            | Postgres + scoped local DB   | Owner                                    | Until account deletion                              |
| Weight         | measurement, date, note                          | Tracking and reports       | Postgres + scoped local DB   | Owner; explicit share only               | Until user deletes/account deletion                 |
| Nutrition      | foods, calories, macros, notes                   | Diary and summaries        | Postgres + scoped local DB   | Owner; explicit share only               | Until user deletes/account deletion                 |
| Exercise       | templates, sessions, effort, notes               | Planning and history       | Postgres + scoped local DB   | Owner; explicit share only               | Until user deletes/account deletion                 |
| Habits         | definition, schedule, completion                 | Behaviour tracking         | Postgres + scoped local DB   | Owner; explicit share only               | Until user deletes/account deletion                 |
| Wellbeing      | mood, energy, sleep, notes                       | Self-reflection            | Postgres + scoped local DB   | Owner; not shared by default             | Until user deletes/account deletion                 |
| Sharing        | grant, recipient, scope, status                  | Consent and collaboration  | Postgres                     | Grant owner/recipient as needed          | Grant life + security audit period                  |
| Device         | platform, push token hash, last seen             | Notifications and security | Postgres/SecureStore         | Owner and trusted service                | Expire inactive device records after defined period |
| Audit          | actor, action, resource reference, safe metadata | Security/accountability    | Protected Postgres schema    | Authorised security operations           | Defined legal/security period; proposed 12 months   |
| Product events | event name, app version, coarse platform         | Reliability and UX         | Approved EU-region processor | Aggregated/authorised product roles      | Proposed 13 months maximum                          |
| Crash reports  | stack, release, redacted context                 | Reliability                | Approved processor           | Engineering on least privilege           | Proposed 90 days                                    |
| Backups        | database backup, user export                     | Recovery/data portability  | Managed encrypted storage    | Restricted operations or requesting user | Provider schedule; exports short-lived              |

### Implemented weight record

- `weight_entries`: owner ID, observation UUID, calendar date, canonical kilograms, optional note, revision, operation ID, timestamps, and deletion tombstone.
- `weight_goals`: one owner-scoped target weight, optional target date, revision, operation ID, timestamps, and deletion tombstone.
- Browser presentation converts kilograms to pounds only at the interface boundary; stored values remain kilograms.
- Operation IDs and revisions are operational metadata. They must never be emitted to analytics with health payloads.

## Data-flow boundaries

1. The client authenticates with Supabase Auth.
2. Health records are written to a user-scoped local database and synchronised to Postgres.
3. Postgres RLS enforces ownership and explicit sharing grants.
4. Realtime sends permitted change events only.
5. Edge Functions handle privileged workflows such as export jobs and notification dispatch.
6. Notifications contain generic text by default and no health value.
7. Observability receives allowlisted operational metadata after central redaction.

## Local data

- One database namespace per authenticated user.
- Durable auth secrets use platform-secure storage where available.
- No health history in browser localStorage.
- Sign-out closes stores, clears in-memory query data, and removes session-only records.
- Device removal and account deletion include local wipe instructions; remote wipe is best effort unless a managed-device capability exists.

## Sharing rules

- Ownership never transfers through sharing.
- Household membership is not authorisation.
- Grants specify owner, recipient, category, permission, and revocation time.
- Revoked records are removed from recipient caches on the next authenticated connection; server access ends immediately.
- Exports include only data owned by the requester unless a separate lawful shared-export rule is approved.

## Deletion and recovery

- Individual entries use tombstones long enough to synchronise across devices.
- Account deletion requires recent authentication and an explicit confirmation summary.
- A short deletion grace period may allow recovery; its length requires product/legal approval.
- After the grace period, owned records, attachments, device tokens, and sharing grants are removed or irreversibly anonymised according to legal obligations.
- Aggregates must not permit re-identification.

## Required pre-launch decisions

- Controller/processor roles and lawful bases under UK GDPR.
- Exact retention periods and backup expiry behaviour.
- Age gate and policy for accidental child accounts.
- International data-transfer mechanism for every vendor.
- Whether any feature falls within medical-device regulation.
- Data Protection Impact Assessment requirement and owner.
