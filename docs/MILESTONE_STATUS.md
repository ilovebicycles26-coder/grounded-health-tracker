# Milestone status

Last updated: 4 August 2026

## Milestone 0 — Product and compliance discovery

Status: Complete. Documentation checks passed on 2 August 2026.

### Deliverables

- [x] Commercial product requirements and first-release boundary.
- [x] User roles and sharing model.
- [x] Non-functional and performance requirements.
- [x] Sensitive-data map and preliminary retention classification.
- [x] STRIDE-based threat model and security invariants.
- [x] WCAG 2.2 AA accessibility baseline.
- [x] Privacy-safe analytics allowlist.
- [x] Prototype migration inventory and reconciliation plan.

### Decisions recorded

- UK-first assumption.
- Responsive web/PWA beta first; iOS/Android next; desktop later.
- Adults-only initial release.
- Manual nutrition entry before licensed food databases.
- Household membership does not grant access; explicit sharing does.
- Existing prototype remains separate until a reconciled migration.

### External reviews still required before commercial launch

- UK GDPR/privacy counsel and DPIA decision.
- Medical-device/regulatory classification review.
- Final data-retention schedule and vendor DPAs.
- External accessibility audit and penetration test.

### Technical debt

- None introduced in the commercial codebase; no application code exists yet.
- Prototype technical debt remains catalogued in the architecture blueprint.

## Milestone 1 — Foundation

Status: Complete. Full quality gate passed on 2 August 2026.

### Deliverables

- [x] pnpm/Turborepo monorepo with a reproducible lockfile.
- [x] Strict shared TypeScript configuration.
- [x] Automated Clean Architecture import-boundary check.
- [x] React/Vite web shell with lazy feature routes and error handling.
- [x] Expo/React Native mobile shell with typed routes and real iOS bundle export.
- [x] Shared domain, application, configuration, design-token/UI, and test-kit packages.
- [x] Accessible web primitive baseline and mobile semantic headings.
- [x] Vitest, Testing Library, jsdom, ESLint, Prettier, and Turborepo caching.
- [x] GitHub Actions quality workflow and Dependabot configuration.
- [x] Eight accepted architecture decision records.
- [x] Expo SDK compatibility and workspace peer-dependency audits.

### Verification

- Formatting: passed.
- Architecture boundaries: passed.
- ESLint with zero warnings: passed.
- Strict TypeScript: 7 of 7 packages passed.
- Tests: 2 files and 3 tests passed.
- Web production build: passed; entry bundle 90.46 kB gzip.
- Expo iOS export: passed; 1,100 modules bundled.
- Expo dependency compatibility: passed.
- Workspace peer dependencies: no issues.

### Technical debt

- The baseline test count is intentionally small because feature code has not begun; coverage thresholds will grow with each feature milestone.
- Android bundle export is not yet a CI gate; native mobile application code is platform-neutral and iOS export is the Milestone 1 compile gate.
- Remote Turborepo caching is not configured.

## Milestone 2 — Identity and security

Status: Complete. Full quality and database security gates passed on 2 August 2026.

### Deliverables

- [x] Framework-neutral, strict-TypeScript authentication and profile contracts.
- [x] Pinned Supabase client adapter with safe error mapping and adapter tests.
- [x] Accessible sign-in, registration, confirmation, recovery, and password-reset routes.
- [x] Protected routes and authenticated profile bootstrap.
- [x] Explicit session-only or durable web login and mobile SecureStore adapter.
- [x] Additive `profiles` migration, explicit grants, and owner-only RLS policies.
- [x] Restricted signup trigger with an empty search path and no public execute permission.
- [x] Transactional RLS test proving accounts cannot read or update another profile.
- [x] Supabase security and performance advisor review.

### Verification

- Formatting, architecture boundaries, and ESLint with zero warnings: passed.
- Strict TypeScript: 9 of 9 workspace packages passed.
- Tests: 4 files and 7 tests passed.
- Web and Expo iOS production builds: passed.
- Supabase: two existing accounts bootstrapped and RLS enabled.
- RLS impersonation: own profile visible; cross-account write affected zero rows.
- Expo compatibility and workspace peer dependencies: passed.

### Technical debt and known constraints

- Development currently shares the prototype Supabase project. Commercial staging and production must use separate projects before beta.
- That shared project has pre-existing prototype advisor warnings for public `SECURITY DEFINER` RPCs and disabled leaked-password protection. Milestone 2 introduced no new advisor findings.
- The Milestone 2 web entry-chunk debt was resolved by Milestone 4 vendor splitting and a release-blocking bundle budget.
- Native auth screens and mobile deep-link handling are scheduled with mobile delivery; the secure mobile storage boundary compiles now.

## Milestone 3 — Local data and sync kernel

Status: Complete. Full quality gate passed on 2 August 2026.

### Deliverables

- [x] Platform-neutral local entity, outbox, conflict, and database contracts.
- [x] Repository writes that atomically persist a record and its mutation operation.
- [x] Stable operation IDs for future server-side idempotency.
- [x] Account-scoped store manager that closes the previous account before opening another.
- [x] Dexie/IndexedDB web adapter with versioned schema, compound indexes, and transactions.
- [x] Expo SQLite mobile adapter with WAL mode, version-one tables, indexes, and transactions.
- [x] Sync coordinator with batching, partial-response protection, and bounded exponential retry.
- [x] Three-way conflict resolution for disjoint edits and durable manual-review conflicts.
- [x] Observable `synced`, `offline`, `syncing`, and `action_required` state.
- [x] Visible web and mobile save/sync status surfaces.
- [x] Web account lifecycle wired to an authenticated user-scoped local database.

### Verification

- Formatting, architecture boundaries, and ESLint with zero warnings: passed.
- Strict TypeScript: 11 of 11 workspace packages passed.
- Tests: 7 files and 16 tests passed.
- IndexedDB persistence survived database close and reopen in integration tests.
- Cross-account local writes were rejected and account switching closed the prior store.
- Retry, acknowledgement, partial-result, automatic merge, and manual-conflict behaviour passed.
- Web and Expo iOS production builds passed; Expo SDK and peer dependency audits passed.

### Technical debt and known constraints

- The Supabase transport remains a port until feature-specific cloud schemas exist; no prototype records or new cloud feature tables were connected.
- Native SQLite is compiled into the iOS bundle but still needs on-device migration and process-termination tests before mobile beta.
- Mobile SQLite currently relies on the operating-system application sandbox. SQLCipher or an equivalent encryption-at-rest decision is required before production health records are enabled.
- Background sync scheduling, realtime pull, and resumable cursors are deferred until the first cloud-backed feature.
- The Milestone 3 web entry-chunk debt was resolved by Milestone 4 vendor splitting and a release-blocking bundle budget.

## Milestone 4 — App shell and settings

Status: Complete. Full quality, mobile-build, performance, and database security gates passed on 3 August 2026.

### Deliverables

- [x] Responsive web shell with persistent desktop navigation, phone bottom navigation, safe-area handling, and a keyboard skip link.
- [x] Native mobile tab shell with persisted on-device appearance controls.
- [x] Versioned, Zod-validated settings registry with independent field recovery and privacy-preserving defaults.
- [x] System, light, dark, and high-contrast themes plus explicit reduced-motion and reduced-data controls.
- [x] React Hook Form and Zod account forms for display name, timezone, locale, metric/imperial units, week start, calorie display, and analytics consent.
- [x] Lazy settings routes for profile/region, appearance, privacy, and data control.
- [x] Reusable accessible `Button`, `Card`, `TextField`, `SelectField`, `Checkbox`, and `VisuallyHidden` primitives.
- [x] Additive profile-settings migration, typed Supabase update adapter, and live schema/type verification.
- [x] Profile privileges reduced to exactly `SELECT`, `INSERT`, and `UPDATE`; anonymous access and direct client deletion removed.
- [x] Vite vendor splitting and a release-blocking 350 kB maximum JavaScript chunk budget.

### Verification

- Formatting, architecture boundaries, and ESLint with zero warnings: passed.
- Strict TypeScript: 12 of 12 workspace packages passed.
- Tests: 9 files and 24 tests passed.
- Web production build: 14 JavaScript chunks; largest 280.83 kB raw / 89.30 kB gzip; budget passed.
- Expo iOS production export: passed; 1,183 modules bundled into a 2.9 MB Hermes bundle.
- Expo SDK compatibility and strict workspace peer dependency checks: passed.
- Database defaults and week-start constraint verified against the live schema.
- Authenticated role impersonation proved owner updates succeed and cross-account settings updates affect zero rows.
- Security and performance advisor review found no new Milestone 4 issues.

### Technical debt and known constraints

- Commercial staging and production still require projects separate from the shared prototype Supabase project.
- Native account settings will sync after the mobile authentication screens and deep links are implemented; device appearance settings are durable now.
- Offline retry for account-setting mutations will join the feature-specific Supabase transport when the first health feature is cloud-backed.
- Automated browser visual regression remains pending; the available in-app browser could not reach the isolated local development server during this run.
- Global semantic-token shell styles are intentionally centralised for this foundation; route-specific styling should move to CSS Modules as feature screens grow.
- The shared prototype project still has pre-existing `SECURITY DEFINER` and leaked-password-protection advisor warnings; Milestone 4 introduced none.

## Milestone 5 — Weight tracking

Status: Complete. Full quality, mobile-build, sync, and database security gates passed on 4 August 2026.

### Deliverables

- [x] Feature-owned weight domain with canonical kilograms, plausible bounds, notes, dates, personal goals, progress, and seven-entry rolling trends.
- [x] Tested metric/kilogram and imperial/pound presentation conversion without changing stored precision.
- [x] Local-first weight repository over the existing account-scoped IndexedDB/SQLite contract.
- [x] Generic remote hydration added to the sync kernel so a new device can download data without first making a local edit.
- [x] Supabase transport with stable operation replay, optimistic revision checks, soft deletion, conflict results, and remote pulls.
- [x] Normalised `weight_entries` and `weight_goals` tables with authoritative revision/timestamp triggers.
- [x] Owner-only RLS, no anonymous privileges, matching authenticated grants, and indexed policy/query columns.
- [x] Responsive weight route with 90 kg starter goal, summary cards, editable history, explicit deletion, and a cancellable modal entry form.
- [x] Accessible SVG trend chart with a prose summary and equivalent data table.
- [x] Read-only prototype weight import planner with duplicate and quarantine reporting.
- [x] ADR-009 documenting the feature-owned revisioned record pattern for later health modules.

### Verification

- Formatting, architecture boundaries, and ESLint with zero warnings: passed.
- Strict TypeScript: 14 of 14 workspace packages passed.
- Tests: 13 files and 33 tests passed.
- Web production build: 18 JavaScript chunks; weight route 22.55 kB raw / 6.22 kB gzip; bundle budget passed.
- Expo iOS production export: passed; 1,183 modules bundled into a 2.9 MB Hermes bundle.
- Live schema inspection matched the checked-in weight table types and constraints.
- Transactional authenticated-role impersonation proved own inserts/updates and revision increments succeed while cross-account reads and updates fail.
- Supabase security advisors reported no findings introduced by the weight schema.

### Technical debt and known constraints

- Native mobile weight screens wait for native authentication and account bootstrap; the responsive PWA weight experience is phone-ready now and the shared domain/local/sync code compiles into the mobile architecture.
- Commercial staging and production still require projects separate from the shared prototype Supabase project.
- The current inclusive timestamp pull cursor is safe and idempotent but must become a persisted composite cursor before high-volume background sync.
- The prototype importer is deliberately a dry-run planner. No personal prototype record has been copied or mutated.
- Automated browser visual regression remains pending because the in-app browser could not connect to the isolated local server; component interaction semantics and both production builds passed.
- The shared prototype project retains its pre-existing public `SECURITY DEFINER` RPC and leaked-password-protection warnings; Milestone 5 added none.

## Milestones 6–14 — Product modules

Status: Complete in code. Full repository gate passed on 4 August 2026.

- [x] Dashboard composed from live weight data with loading, empty, offline, and error states.
- [x] Nutrition diary, calorie/macro totals, targets, favourites, editing, local-first storage, and RLS sync.
- [x] Editable/versioned exercise routines, sessions, preferences, and curation for cycling, kettlebells, bodyweight, bands, mobility, walking, hula hooping, and custom movement.
- [x] Scheduled habits including supplements, completions, sustainable streaks, reminders, and private wellbeing check-ins.
- [x] One-time partner invitation, separate accounts, explicit/revocable category grants, safe shared weight summary, and cross-account RLS tests.
- [x] Private notification copy, quiet-hour preferences, deep links, and installable Android/iPhone PWA guidance.
- [x] Deterministic versioned achievements with safe count-only evidence and opt-out.
- [x] Accessible weekly reports with chart/table, formula-safe CSV, and print/save-PDF workflow.
- [x] Versioned checksummed ZIP backup, hostile-input validation, dry-run preview, and import-new-only conflict policy.

### Verification

- Architecture boundaries and ESLint: passed with zero warnings.
- Strict TypeScript: 25 of 25 packages passed.
- Tests: 25 files and 50 tests passed after the final notification privacy correction.
- Production builds: 25 of 25 packages passed, including Vite web and Expo iOS export.
- Web: 33 JavaScript chunks; largest 280.83 kB raw, below the 350 kB release limit.
- Live sharing test: explicitly shared routines/habits visible; private wellbeing invisible.
- Final database advisor: no missing foreign-key indexes or duplicate permissive policies from the new schema.

## Milestone 15 — Migration and parallel beta

Status: Engineering preparation complete; execution gated.

- [x] Shape-only inventory of prototype account documents.
- [x] Weight dry-run mapper, quarantine/duplicate reporting, backup preview, reconciliation and rollback runbook.
- [ ] Provision isolated staging/production, obtain Richard and Zoe's opt-in, run preview, reconcile, and accept beta.

## Milestone 16 — Commercial hardening

Status: Internal engineering baseline complete; external assurance outstanding.

- [x] CSP/referrer protections, deployable security-header policy, bundle budget, dependency automation, RLS/advisor review, and release runbooks.
- [x] Repository-subpath-safe PWA and auth callback routing plus gated GitHub Pages deployment workflow.
- [ ] Independent accessibility/security/load audits, legal/privacy review, store compliance, and incident exercise.

## Milestone 17 — Desktop

Status: Deliberately deferred until stable web release. The PWA can already be installed on supported desktop browsers; Tauri packaging would add release risk before providing a validated need.

## Personal-use scope

Status: In implementation.

- [x] Product direction changed from possible commercial release to personal use by Richard and Zoe only.
- [x] Public self-registration removed from web routing and sign-in UI.
- [x] Database allowlist and restrictive RLS boundary designed for exactly the two existing accounts.
- [x] Client access check added before profile bootstrap or account-scoped local storage is opened.
- [x] Applied and verified the personal-access migration in the live Supabase project.
- [ ] Keep source control private and select a personal deployment path.
