# Prototype migration inventory

Source application: `grounded-health-tracker` GitHub Pages PWA.  
Migration principle: copy, transform, reconcile, and obtain user confirmation before cutover. Never mutate the only source during rehearsal.

## Current prototype assets

- Static HTML/CSS/JavaScript PWA.
- Supabase Auth with email/password.
- Household and household-member records.
- Legacy household JSON health-state record.
- Newer per-user JSON health-state records in `user_health_states`.
- Browser localStorage backup keyed by user in recent versions.
- Service-worker caches on installed devices.

## Known JSON fields

- `profile`: name, goal, start, height.
- `weights[]`: ID, weight, date, note.
- `checkins[]`: date, mood, energy, sleep, note.
- `habits[]` and `habitLogs`.
- `customRoutines[]`, `routineEdits`, and `workoutLogs[]`.
- `foodLogs[]` and `calorieTarget`.

## Target mapping

| Prototype                             | Target                                     |
| ------------------------------------- | ------------------------------------------ |
| profile identity/preferences          | `profiles` and settings registry           |
| profile goal/start                    | `weight_goals`                             |
| weights                               | `weight_entries`                           |
| checkins                              | `wellbeing_checkins`                       |
| habits                                | `habit_definitions`                        |
| habitLogs                             | `habit_completions`                        |
| built-in routine edits/customRoutines | `routine_templates` + `routine_steps`      |
| workoutLogs                           | `workout_sessions` + optional step results |
| foodLogs                              | `food_entries`                             |
| calorieTarget                         | `nutrition_targets` with effective date    |
| household membership                  | retained after policy/schema review        |

## Migration hazards

- Earlier household blob used last-write-wins and may have overwritten one person's historical profile.
- Browser-local data may be newer than cloud data.
- Dates were stored without explicit timezone semantics.
- Routine workout logs may not contain full step snapshots.
- Habits use composite string keys.
- Food calories are manually entered and may not have quantity/unit metadata.
- Some identifiers are semantic strings; others are UUIDs.
- Mojibake may exist in older static assets, but persisted Unicode values require separate inspection.

## Migration algorithm

1. Freeze a consistent source snapshot and record checksums.
2. Discover every account, membership, cloud document version, and available user-provided backup.
3. Select the newest valid per-user source; flag divergent browser/cloud copies for review.
4. Validate with versioned Zod schemas and quarantine malformed records.
5. Transform into target staging tables using deterministic IDs/idempotency keys.
6. Preserve original source payload and transformation version in restricted migration storage.
7. Produce per-user counts, date ranges, and non-sensitive discrepancy summaries.
8. Run database constraints and RLS tests.
9. Let the user preview migrated summaries and resolve conflicts.
10. Mark migration accepted, then enable target writes.
11. Keep prototype read-only for the agreed fallback window.
12. Archive/delete legacy sources only after reconciliation and retention approval.

## Acceptance criteria

- Every valid source entry is migrated exactly once or appears in an explicit exception report.
- Source and target counts reconcile by user and entity type.
- Weight/calorie numeric values retain precision.
- Dates remain on the user's intended calendar day.
- No record changes owner accidentally.
- RLS proves cross-user isolation after migration.
- Rollback restores the pre-cutover state.
- Richard and Zoe explicitly confirm their own summaries before the prototype becomes read-only.

## Implemented weight rehearsal boundary

- The versioned planner accepts only legacy `{ id, date, weight, note }` records.
- Dates must be valid calendar dates and remain unchanged.
- Canonical weights must be finite and between 25 kg and 500 kg.
- Notes over 240 characters are quarantined rather than truncated.
- Exact duplicate records are reported and excluded from the proposed target set.
- Invalid legacy identifiers receive generated UUIDs in the plan; the migration manifest will persist that mapping so retries remain idempotent.
- Planning is read-only. No prototype weight was copied during Milestone 5.
