# Prototype-to-beta migration runbook

Status: Engineering preparation complete; execution requires a separate staging project and explicit user opt-in.

## Source inventory

The shared prototype project contains one household JSON document and two account-scoped JSON documents. Shape-only inspection on 4 August 2026 found these modules: profile, weights, habits, habit logs, wellbeing check-ins, food logs, custom routines, workout logs, and calorie target. No health values were copied during discovery.

The normalised beta schema is available for weight, nutrition, exercise, habits, wellbeing, profiles, and explicit partner sharing. The weight package includes a read-only prototype mapper that quarantines invalid records and reports duplicates.

## Non-negotiable gates

1. Create isolated Supabase staging and production projects; never trial a destructive transform in the shared prototype project.
2. Take and verify an immutable source snapshot.
3. Ask each account holder to opt in and show exactly which categories will move.
4. Run a dry run first. Report source, accepted, duplicate, quarantined, and target counts by user and category.
5. Require zero unexplained count differences and manual review of every quarantine.
6. Import with stable operation IDs so a retry cannot duplicate records.
7. Keep the prototype read-only for the agreed fallback window. Do not dual-write.
8. Obtain account-holder acceptance before making beta the primary application.

## Transformation order

1. Profiles and regional preferences.
2. Weight entries and the 90 kg goal.
3. Habit definitions, then completions.
4. Wellbeing check-ins; notes remain private.
5. Nutrition target, then food entries.
6. Exercise routines, then workout sessions.
7. Recreate partner connection and grants interactively; never infer sharing permission from a household record.

## Reconciliation evidence

For every category retain only non-sensitive evidence: source count, accepted count, quarantine count, duplicate count, target count, transform version, start/end timestamps, and a checksum of stable record IDs. Never log notes, weights, calories, mood values, routine text, email addresses, or invite codes.

## Rollback

Before acceptance, rollback means deleting the isolated beta import and returning to the untouched prototype. After acceptance, stop new beta writes, export a beta backup, restore the last verified snapshot, and reconcile again. Database migrations are forward-only; use corrective migrations rather than editing migration history.

## Current execution blockers

- Separate commercial staging/production projects have not been provisioned.
- Richard and Zoe have not yet approved a migration preview.
- Privacy/regulatory review and the retention schedule remain external launch gates.
