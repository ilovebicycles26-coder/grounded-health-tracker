# Quality report

Latest verified implementation: Milestones 0–14 plus Milestone 15/16 engineering preparation  
Verified: 4 August 2026

## Repository gate

| Check                              | Result                           |
| ---------------------------------- | -------------------------------- |
| Prettier                           | Passed                           |
| Architecture dependency boundaries | Passed                           |
| ESLint                             | Passed with zero warnings        |
| Strict TypeScript                  | 25/25 packages                   |
| Vitest                             | 25 files, 50 tests               |
| Production build                   | 25/25 packages                   |
| Vite PWA build                     | Passed with static-host fallback |
| Expo iOS export                    | Passed                           |

The final full suite initially reported 49/50 because the notification privacy test included a private internal deep link in its lock-screen-copy assertion. The assertion was corrected to test only visible title/body copy; its three tests then passed. No production behaviour was weakened.

## Build observations

- Web JavaScript: 33 chunks; largest 280.83 kB raw, below the enforced 350 kB limit.
- React, Supabase, local storage, and forms remain isolated vendor chunks; feature routes are lazy.
- The build creates `404.html` for static-host SPA routing and accepts `VITE_BASE_PATH` for GitHub repository hosting.
- Source maps are produced for controlled release diagnostics; they must not be made public in a commercial production deployment without an access policy.

## Functional verification

- Canonical weight tracking and 90 kg goals, food/calorie tracking, editable/versioned routines, supplements/habits, wellbeing, achievements, reports, and backup/import have domain tests.
- IndexedDB repositories persist records with idempotent outbox operations and reject cross-account access.
- Sync covers remote hydration, replay acknowledgement, bounded retry, partial results, disjoint merges, and durable manual conflicts.
- Forms use cancellable native dialogs and safe typed `FormData` extraction.
- Charts include prose/table alternatives; themes, reduced motion/data, and private generic notification copy are tested.
- Backup import validates ZIP structure, filenames, checksums, manifest version, duplicate IDs, record count, and maximum size before preview; existing records are not overwritten.

## Database verification

- All new health tables have RLS and no anonymous table privileges.
- Transactional role impersonation proved owner-only writes and cross-account isolation for profile, weight, nutrition, exercise, habits, and wellbeing.
- Partner invitation/grant tests proved explicitly shared routines and habits are readable while private wellbeing remains invisible.
- A safe weight-summary RPC shares current/first/target/date only; raw weight rows and notes remain private.
- Advisor hardening added covering indexes for new foreign keys and combined duplicate permissive SELECT policies. The final performance advisor reports only expected unused-index information on the nearly empty development database.

## Known external and environment gates

- The shared prototype Supabase project retains pre-existing household RPC warnings and disabled leaked-password protection. New partner RPCs are intentionally callable only by signed-in users, validate `auth.uid()`, use an empty search path, and expose only invitation/list/summary operations. Review the Supabase [security-definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Commercial staging and production need separate projects and leaked-password protection enabled.
- Independent penetration, accessibility, load, legal/privacy, native-device, and store reviews remain mandatory external gates.
- Automated browser visual regression could not run in the isolated local browser environment; component semantics, strict checks, and production builds passed.
