# Analytics and observability policy

Grounded uses privacy-safe product events only when necessary to improve reliability and usability.

## Never collect

- Weight or weight change.
- Calories, macros, targets, meal names, or foods.
- Exercise names, duration, effort, routines, or notes.
- Mood, energy, sleep, habit names, completions, or free text.
- Email, display name, invite code, access token, or precise location.
- Raw record identifiers.

## Allowlisted event shape

```text
event_name
event_schema_version
occurred_at
app_version
platform
environment
anonymous_installation_id
session_id
feature
result: success | cancelled | validation_error | offline_pending | service_error
safe_error_code (optional)
duration_bucket (optional)
```

## Example permitted events

- `registration_completed`
- `email_confirmation_completed`
- `feature_entry_created` with `feature=weight|nutrition|exercise|habit|wellbeing`
- `sync_cycle_completed` with result and coarse duration bucket
- `sharing_invitation_completed`
- `sharing_grant_revoked`
- `export_completed`
- `account_deletion_completed`

An event may say an entry was created, but never contain the entry's value or text.

## Controls

- Compile-time event catalogue; arbitrary event names are rejected.
- Runtime schema validation and central redaction before transport.
- Development payload inspector and automated privacy snapshots.
- Consent and opt-out appropriate to the selected legal basis/vendor configuration.
- EU/UK-compatible processing configuration and least-privilege access.
- Retention proposed at no more than 13 months; final period requires privacy approval.
- Product analysis uses aggregate cohorts with minimum group-size rules.

## Crash reporting

Stack traces, application version, safe breadcrumbs, and device class may be captured. Request bodies, database rows, form values, URLs containing tokens, and state snapshots are prohibited. Source maps are private release artefacts.
