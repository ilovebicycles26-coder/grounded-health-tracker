# Grounded Product Engineering Blueprint

Status: Architecture approved; Milestones 0–14 implemented and verified. Milestones 15–16 are prepared but externally gated.  
Document owner: Lead Engineering  
Last updated: 4 August 2026

## 1. Product intent

Grounded is a privacy-first, multi-platform personal health product for individuals and invited partners. It should make weight, nutrition, movement, habits, and wellbeing understandable without shame or unnecessary complexity.

The existing GitHub Pages application is a useful product prototype. It validates the core workflows, but its global mutable state, single JavaScript file, JSON-blob persistence, and direct DOM rendering are not a suitable base for a commercial product. It remains live while a replacement is built and migrated deliberately.

### Architectural quality goals

- Strict type safety from database to UI.
- Feature isolation: nutrition work must not destabilise weight tracking.
- Offline-capable writes with deterministic synchronisation.
- User-level privacy with explicit, revocable sharing.
- Web, iOS, and Android clients sharing business rules without forcing identical UI.
- Fast startup and route-level code splitting.
- Automated tests at domain, data, component, integration, and end-to-end levels.
- Accessible, calm, mobile-first interaction design.
- Schema migrations and backwards-compatible client releases.

## 2. Technology decisions

| Area                 | Choice                                                                        | Why                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Repository           | pnpm workspaces + Turborepo                                                   | One source of truth for multiple apps and shared packages; cached builds and focused CI.                           |
| Language             | TypeScript, strict mode                                                       | Prevents invalid states and makes cross-platform contracts refactorable. No `any` in application code.             |
| Web                  | React + Vite + React Router                                                   | Fast, standards-based PWA with explicit routing and no server-rendering complexity for an authenticated dashboard. |
| Mobile               | Expo + React Native + Expo Router                                             | Production iOS/Android delivery, strong TypeScript support, OTA updates, and first-class monorepo support.         |
| Desktop              | Deferred; Tauri shell around web client                                       | Small native footprint. Introduce only after web/mobile reach product maturity.                                    |
| Backend              | Supabase Auth, Postgres, Storage, Realtime, Edge Functions                    | Managed auth and relational persistence with database-enforced RLS; current product already uses Supabase.         |
| Server state         | TanStack Query                                                                | Query caching, invalidation, mutation lifecycle, retry policy, and offline mutation support.                       |
| Client state         | Zustand, limited to transient UI/session preferences                          | Small API and low coupling. Persistent health records do not live in a global UI store.                            |
| Forms                | React Hook Form + Zod                                                         | Accessible forms, low rerender cost, shared runtime validation, and inferred TypeScript types.                     |
| Local database       | Dexie/IndexedDB on web; Expo SQLite on mobile behind one repository interface | Structured local queries and migrations; localStorage is unsuitable for growing health histories.                  |
| Date/time            | Temporal polyfill until platform support is sufficient                        | Explicit dates, instants, and time zones; avoids ambiguous JavaScript Date behaviour.                              |
| Charts               | Visx primitives behind Grounded chart components                              | Accessible, composable charts without tying feature code to a chart vendor.                                        |
| Styling              | Design tokens + CSS Modules on web; token adapters on React Native            | Stable visual system, local styles, theme parity, and no runtime CSS-in-JS requirement.                            |
| Unit/component tests | Vitest + Testing Library                                                      | Fast tests close to source and user-focused component assertions.                                                  |
| E2E                  | Playwright web; Maestro mobile                                                | Covers real authentication, offline recovery, editing, and critical journeys.                                      |
| API mocking          | MSW                                                                           | Same network simulations in tests and Storybook.                                                                   |
| Observability        | Sentry interface with PII scrubbing; structured internal logger               | Actionable production errors without recording health data. Vendor is replaceable.                                 |
| Product analytics    | Opt-in, event allowlist, no health values                                     | Measures usability while protecting sensitive information.                                                         |
| CI/CD                | GitHub Actions; preview, staging, production environments                     | Repeatable checks, migrations, releases, and rollback gates.                                                       |

### Deliberately rejected

- A universal React Native UI for every platform: it maximises theoretical reuse but compromises web semantics and desktop accessibility. Domain logic is shared; platform UI is adapted.
- Redux for all data: server records and offline entities need repositories and query caching, not one global object.
- One JSON blob per user: it creates write conflicts, poor reporting, difficult migrations, and unbounded payloads.
- Microservices: thousands of users do not justify their operational cost. Use a modular monolith and extract services only from measured pressure.
- Premature plugin execution from third parties: feature modules are first-party compile-time packages initially. A sandboxed external plugin API is a later product decision.

## 3. Repository structure

```text
grounded/
  apps/
    web/                    # React PWA
      src/app/              # composition root, providers, router
      src/routes/           # route components only
      src/platform/         # browser adapters
    mobile/                 # Expo iOS/Android
      app/                  # Expo Router screens
      src/platform/         # SQLite, notifications, health integrations
    admin/                  # deferred internal support console
  packages/
    domain/                 # entities, value objects, policies; no framework imports
    application/            # use cases, commands, queries, ports
    data/                   # repository contracts and shared mapping/sync logic
    supabase/               # generated DB types and remote repository adapters
    local-store/            # platform-neutral local DB contracts and migrations
    auth/                   # session and identity application services
    feature-dashboard/
    feature-weight/
    feature-nutrition/
    feature-exercise/
    feature-habits/
    feature-wellbeing/
    feature-achievements/
    feature-reports/
    feature-settings/
    ui/                     # tokens, primitives, icons, accessibility contracts
    charts/                 # weight/calorie/activity chart abstractions
    notifications/          # scheduling domain and platform ports
    backup/                 # versioned export/import format
    observability/          # logger, metrics and error-reporting interfaces
    config/                 # typed environment and remote feature flags
    test-kit/               # factories, fixtures, fake clocks/repositories
  supabase/
    migrations/             # immutable SQL migrations
    functions/              # Edge Functions
    seed/                   # non-production fixtures
    tests/                  # RLS and database contract tests
  docs/
    decisions/              # ADRs
    product/
    runbooks/
    privacy/
  tooling/
    eslint-config/
    typescript-config/
  .github/workflows/
```

Dependency direction is enforced by ESLint boundaries:

```text
UI/routes -> feature application layer -> application ports -> domain
                                      -> repository interfaces
platform adapters / Supabase ---------> repository interfaces
```

The domain never imports React, Supabase, browser APIs, or mobile APIs. This is the practical Clean Architecture boundary that keeps rules testable.

## 4. Feature-module contract

Every feature exports one manifest:

```ts
interface FeatureModule {
  id: FeatureId;
  routes: readonly RouteDefinition[];
  navigation: readonly NavigationItem[];
  permissions: readonly Permission[];
  registerServices(registry: ServiceRegistry): void;
  registerSync(registry: SyncRegistry): void;
  registerBackup(registry: BackupRegistry): void;
}
```

Features own their routes, use cases, validation schemas, repository interface extensions, telemetry allowlist, and tests. The app composition root registers manifests. This permits achievements, medication, sleep, wearable integrations, or clinician reports to be added without editing a central switch statement throughout the product.

No feature may access another feature's database tables directly. Cross-feature behaviour uses application events or stable query ports.

## 5. Core data model

All primary keys are UUIDv7 generated client-side, allowing offline creation. Mutable tables carry `created_at`, `updated_at`, `revision`, and nullable `deleted_at`. Dates representing a user's day use `date`; events use `timestamptz`. Units are stored explicitly.

### Identity and collaboration

- `profiles(user_id PK, display_name, timezone, locale, unit_system, week_starts_on, calorie_display, analytics_consent, avatar_path)`
- `households(id PK, name, created_by)`
- `household_members(household_id, user_id, role, status)`
- `sharing_grants(id, owner_user_id, recipient_user_id, resource_type, permission, revoked_at)`

Household membership does not imply access to health records. A user explicitly shares categories such as progress summary, routines, or meal plans. Raw notes and wellbeing entries default to private.

### Health modules

- `health_goals(id, user_id, type, target_value, unit, start_date, target_date, status)`
- `weight_entries(id, user_id, measured_on, value_kg, note, source)`
- `food_entries(id, user_id, consumed_at, meal_type, name, calories_kcal, quantity, unit, notes)`
- `nutrition_targets(id, user_id, effective_from, calories_kcal, protein_g, carbs_g, fat_g)`
- `food_favourites(id, user_id, name, nutrition_snapshot)`
- `routine_templates(id, owner_user_id, name, description, estimated_minutes, visibility, version)`
- `routine_steps(id, routine_id, position, activity_type, title, instructions, prescription_json)`
- `workout_sessions(id, user_id, routine_id nullable, started_at, completed_at, duration_seconds, perceived_effort, notes)`
- `workout_step_results(id, session_id, routine_step_id nullable, title_snapshot, result_json)`
- `habit_definitions(id, user_id, name, icon, schedule_json, archived_at)`
- `habit_completions(id, habit_id, user_id, completed_on)`
- `wellbeing_checkins(id, user_id, checked_on, mood, energy, sleep, note)`
- `achievements(id, code, version, criteria_json)`
- `user_achievements(user_id, achievement_id, earned_at, evidence_json)`

Snapshots in food and workout history protect historical accuracy when a favourite or routine is later edited. Routine template edits create a new version once the template has completed sessions; they do not rewrite history.

### Operations

- `devices(id, user_id, platform, push_token_hash, last_seen_at)`
- `notification_preferences(user_id, category, enabled, local_time, timezone)`
- `audit_events(id, actor_user_id, action, resource_type, resource_id, occurred_at, metadata_safe)`
- `sync_changes(sequence bigint, user_id, entity_type, entity_id, operation, changed_at)`
- `import_jobs(id, user_id, format_version, status, summary, error_code)`

Sensitive note text never enters audit metadata or analytics.

## 6. Database and authorization

- Normalised Postgres tables replace the prototype JSON state.
- RLS is enabled on every exposed table.
- Policies use `auth.uid()` and indexed ownership/membership columns.
- `anon` receives no health-table privileges.
- Shared access requires both an active household membership and an explicit sharing grant.
- Every insert/update verifies immutable ownership with `WITH CHECK`.
- Security-definer functions are exceptional, have fixed `search_path`, explicit grants, input validation, and database tests.
- Service-role credentials exist only in trusted server environments.
- Storage buckets use owner-scoped paths and matching RLS.
- Database migrations are forward-only and tested against a production-shaped staging dataset.

The current `user_health_states` JSON table becomes a migration source, then read-only for a release window, then archived. A reconciliation report must prove migrated row counts before removal.

## 7. Application data flow

1. A screen calls a feature use case.
2. The use case validates a command and applies domain rules.
3. A repository transaction writes the local database and an outbox item atomically.
4. The UI updates optimistically from local data.
5. The sync worker sends idempotent mutations to Supabase.
6. Server acknowledgements update revision/sync metadata.
7. Realtime or pull-sync changes are merged into the local database.
8. TanStack Query invalidates only affected query keys.

Repositories return typed `Result<T, DomainError>` values for expected failures. Unexpected failures throw and are handled by boundaries.

## 8. Synchronisation strategy

Local-first behaviour is a product requirement, not an incidental cache.

- `outbox`: operation ID, entity, payload, base revision, attempts, next attempt time.
- Idempotency keys prevent duplicate creates.
- Server timestamps are authoritative for ordering; user-local dates remain unchanged.
- Independent entries merge naturally.
- Concurrent edits to the same record use optimistic concurrency (`revision`).
- Conflict policy: auto-merge disjoint fields; otherwise retain both versions and ask the user.
- Deletes are tombstones until all active devices acknowledge them.
- Exponential retry with jitter; permanent validation/auth errors are not retried.
- Sync state is visible: synced, offline, syncing, or action required.
- Account switching closes the local database, clears in-memory caches, and opens a user-scoped encrypted store where supported.

TanStack Query orchestrates remote state and mutation status; it is not the durable outbox itself.

## 9. Routing

### Public

- `/welcome`
- `/sign-in`
- `/sign-up`
- `/confirm-email`
- `/forgot-password`
- `/reset-password`
- `/invite/:token`
- `/privacy`, `/terms`, `/accessibility`

### Authenticated shell

- `/today`
- `/progress/weight`
- `/nutrition`
- `/nutrition/day/:date`
- `/exercise`
- `/exercise/routines`
- `/exercise/routines/:routineId`
- `/exercise/session/:sessionId`
- `/habits`
- `/wellbeing`
- `/achievements`
- `/reports`
- `/settings/profile`
- `/settings/preferences`
- `/settings/privacy`
- `/settings/goals`
- `/settings/sharing`
- `/settings/notifications`
- `/settings/data`

Routes are lazy-loaded at feature boundaries. Authentication, onboarding completion, and entitlement guards are separate composable guards. Mobile uses the same route concepts with native stacks/tabs.

## 10. Component hierarchy

```text
AppRoot
  ErrorBoundary
  ObservabilityProvider
  ConfigurationProvider
  ThemeProvider
  AuthProvider
  LocalDatabaseProvider
  QueryClientProvider
  SyncProvider
  NotificationProvider
  Router
    PublicLayout
    AuthenticatedLayout
      AppHeader
      AdaptiveNavigation
      SyncStatus
      RouteOutlet
      ToastViewport
```

Feature screens compose feature components and shared primitives. Screens never call Supabase directly.

Shared UI primitives: `Button`, `IconButton`, `TextField`, `NumberField`, `Select`, `Checkbox`, `DateField`, `Dialog`, `Sheet`, `Card`, `Tabs`, `Progress`, `EmptyState`, `Skeleton`, `ErrorState`, `Toast`, `Menu`, `List`, `DataTable`, `VisuallyHidden`.

Primitives support keyboard operation, visible focus, reduced motion, screen readers, dynamic text, touch targets, loading states, and disabled reasons. WCAG 2.2 AA is the acceptance baseline.

## 11. Authentication flow

1. Bootstrap configuration and restore the Supabase session through the official client.
2. Validate/refresh the token before loading private data.
3. Open the local database namespace for `user_id` only after identity is known.
4. Load profile/onboarding status.
5. Route confirmed users to onboarding or `/today`.
6. Email confirmation and password recovery use explicit deep-link routes on web and mobile.
7. “Stay signed in” controls durable versus session-only token storage through platform auth-storage adapters.
8. Sign-out stops sync, flushes safe pending work, unregisters push tokens, clears memory, closes the user database, and removes tokens.

Future MFA/passkeys are auth-provider capabilities and do not change feature code.

## 12. State management

- Domain entities: local repositories + TanStack Query selectors.
- Remote mutation status: TanStack Query.
- Auth identity: auth service/provider.
- Theme, navigation state, temporary filters: Zustand.
- Form drafts: React Hook Form; explicit autosave only for long notes.
- URL-addressable filters: router search parameters.
- Never mirror the same authoritative entity into multiple stores.

Selectors are narrow and memoised. Lists are virtualised only after measurement shows a need.

## 13. Storage and settings

Settings use a typed registry:

```ts
interface SettingDefinition<T> {
  key: string;
  schema: ZodSchema<T>;
  defaultValue: T;
  scope: 'device' | 'account';
  version: number;
}
```

Device settings include theme and reduced-data mode. Account settings include units, calorie display preference, reminders, sharing, and privacy choices. Feature flags come from signed remote configuration with safe local defaults.

No health history is stored in browser localStorage. localStorage is limited to non-sensitive bootstrap preferences. Web structured data uses IndexedDB; mobile uses SQLite/SecureStore according to sensitivity.

## 14. Error handling

Errors are a discriminated union: `ValidationError`, `AuthenticationError`, `AuthorizationError`, `ConflictError`, `OfflineError`, `RateLimitError`, `NotFoundError`, `ServiceUnavailableError`, and `UnexpectedError`.

- Field errors appear beside fields.
- Recoverable operation errors appear inline with Retry.
- Offline writes show pending state, not failure.
- Route failures use feature error boundaries.
- Fatal bootstrap failures use a recovery screen with diagnostics ID.
- User messages are calm and actionable; raw backend messages are never shown.
- Error mapping occurs at adapter boundaries.

## 15. Logging and observability

Structured log fields: timestamp, level, event name, app version, platform, environment, correlation ID, anonymous installation ID, feature, and safe error code.

Prohibited fields: weight, calories, meal names, notes, email, access tokens, invite tokens, and free text. A central redaction layer runs before every sink. Production console logging is minimal. Crash reports require consent where legally necessary.

Service objectives are defined for sign-in success, sync latency, crash-free sessions, and key workflow completion. Alerts point to runbooks.

## 16. Theming and charts

Semantic tokens—not raw colours—define surfaces, text, borders, actions, success, warning, danger, chart series, spacing, radius, typography, elevation, and motion. Light, dark, high-contrast, and system themes share the same token contract.

Charts accept domain-neutral series data and expose:

- visual SVG/canvas rendering;
- an accessible text summary;
- a data table alternative;
- unit-aware axes;
- empty/loading/error states;
- reduced-motion behaviour;
- export-safe rendering.

Weight trends separate raw entries from optional rolling averages. Charts never imply medical conclusions.

## 17. Notifications

Feature code requests a semantic reminder (`habit.due`, `weigh_in.weekly`, `routine.planned`) through a notification port. Platform adapters schedule local or push notifications.

- Explicit opt-in per category.
- Time-zone and daylight-saving safe.
- Quiet hours and frequency caps.
- Deep link to the relevant workflow.
- No health detail on lock screens by default.
- Server jobs are idempotent and record delivery status without sensitive content.

## 18. Backup, import, and export

The canonical backup is a versioned ZIP containing a JSON manifest and NDJSON per entity type. It includes schema version, export time, units, checksums, and optional attachments. Exports are generated server-side for complete accounts and require recent authentication.

Import pipeline: parse -> malware/size checks -> validate -> preview -> dry-run conflict report -> explicit confirmation -> transactional batches -> reconciliation report. Imports never silently overwrite existing records.

Human-readable CSV exports are available per module. Account deletion uses a grace period, revokes sessions, removes sharing grants, and produces an auditable deletion job.

## 19. Performance strategy

- Route-level and heavy-chart code splitting.
- Local database indexes on user/date and foreign keys.
- Cursor pagination for histories.
- Aggregated daily/weekly views for reports; raw events remain canonical.
- Batched sync and payload limits.
- Image resizing before upload.
- Performance budgets in CI for web bundles and Core Web Vitals.
- Query plans measured before adding indexes; no speculative caching layers.

## 20. Security, privacy, and compliance posture

Health and wellbeing data is treated as sensitive from day one. Commercial launch requires a documented GDPR role assessment, lawful basis, privacy notice, retention schedule, data-subject request process, breach runbook, vendor DPAs, threat model, penetration testing, and counsel review. The product must not claim medical-device status or medical outcomes without a separate regulatory assessment.

Security controls include CSP, dependency scanning, secret scanning, protected branches, least privilege, rate limiting, RLS tests, secure deep links, short-lived tokens, MFA for staff, environment separation, encrypted transport, managed backups, restore drills, and audited admin access.

## 21. Testing strategy

- Domain unit tests: calculations, streaks, units, schedule rules, conflict resolution.
- Contract tests: every repository adapter passes the same suite.
- Database tests: RLS isolation, sharing grants, constraints, migrations, query plans.
- Component tests: accessibility and interaction states.
- Integration tests: feature use case through fake/local/remote adapters.
- E2E: registration, recovery, offline logging, sync, account switching, sharing/revocation, backup/import, deletion.
- Visual regression: critical responsive screens and themes.
- Performance tests: startup, long histories, sync batches.
- Security tests: cross-user access attempts and malicious import payloads.

CI gates: format, lint, typecheck, unit, component, database, build, dependency audit, E2E smoke, bundle budget. Releases use staged rollout and rollback criteria.

## 22. Implementation roadmap

Complexity scale: S (up to 1 engineering week), M (1–2), L (2–4), XL (4–6). Estimates are relative planning ranges, not delivery commitments; design, QA, and review are included.

| #   | Milestone                        | Deliverable and acceptance gate                                                                                        | Complexity | Dependencies       |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| 0   | Product and compliance discovery | Product requirements, threat model, data map, accessibility target, analytics policy, migration inventory              | M          | None               |
| 1   | Foundation                       | Monorepo, strict TS, boundaries, design tokens, CI, environments, test harness, ADR process; web/mobile shells compile | L          | 0                  |
| 2   | Identity and security            | Auth, confirmation, recovery, session-only/durable login, profile bootstrap, RLS test suite                            | L          | 1                  |
| 3   | Local data and sync kernel       | Web/mobile local DBs, repositories, outbox, idempotency, conflicts, visible sync state                                 | XL         | 1–2                |
| 4   | App shell and settings           | Responsive navigation, theming, accessibility primitives, units/time zone/privacy settings                             | L          | 1–3                |
| 5   | Weight tracking                  | Goals, entries, history, trend chart, validation, import from prototype                                                | M          | 3–4                |
| 6   | Dashboard                        | Today summary, module cards, empty/loading/offline states, personalised navigation                                     | M          | 4–5                |
| 7   | Nutrition                        | Food diary, targets, favourites, daily summaries, safe editing; no external food database yet                          | L          | 3–4                |
| 8   | Exercise                         | Versioned editable routines, sessions, activity history, cycling/kettlebell/bodyweight/band templates                  | L          | 3–4                |
| 9   | Habits and wellbeing             | Schedules, completions, streak rules, private check-ins and notes                                                      | L          | 3–4                |
| 10  | Sharing                          | Explicit category grants, partner UX, invitation, revoke flow, cross-user RLS tests                                    | XL         | 2–3, 5–9           |
| 11  | Notifications                    | Local reminders, preference centre, quiet hours, deep links; push infrastructure if justified                          | M/L        | 4, 8–9             |
| 12  | Achievements                     | Versioned rule engine, earned evidence, accessible celebrations, opt-out                                               | M          | 5, 7–9             |
| 13  | Reports                          | Weekly/monthly aggregates, accessible charts/tables, PDF/CSV summaries                                                 | L          | 5, 7–9             |
| 14  | Backup/import/export             | Versioned full export, dry-run import, CSV exports, reconciliation and deletion flow                                   | L          | 3, 5–10            |
| 15  | Migration and parallel beta      | Transform prototype JSON, reconciliation, opt-in beta, rollback path, telemetry review                                 | XL         | 2–14               |
| 16  | Commercial hardening             | Load/accessibility/security testing, store compliance, incident runbooks, support/admin foundations                    | XL         | All prior          |
| 17  | Desktop                          | Tauri packaging, secure storage, updater, desktop-specific QA                                                          | L          | Stable web release |

Each milestone must independently:

1. compile in strict mode;
2. pass its test pyramid and accessibility checks;
3. contain no dead code or unexplained boundary exceptions;
4. update this document and relevant ADRs;
5. deploy to an isolated preview/staging environment;
6. include migration/rollback notes where data changes;
7. meet its observability and privacy acceptance criteria.

## 23. Delivery sequencing and release policy

Milestones 0–4 form the platform. Feature teams can then build 5, 7, 8, and 9 in parallel against stable contracts. Dashboard follows the first real feature because it should compose working modules, not mocks. Sharing follows private features so permissions can be tested against concrete resources.

The production prototype is not rewritten in place. The new product deploys to staging, imports copied data, runs reconciliation, and enters an opt-in beta. Only after acceptance do users move to the new schema. The old app becomes read-only for a defined fallback window.

## 24. Architecture decision records

Initial ADRs to create before Milestone 1 exits:

- ADR-001: Modular monorepo and package boundaries.
- ADR-002: Separate React web and Expo mobile presentation layers.
- ADR-003: Local-first repositories and transactional outbox.
- ADR-004: Supabase/Postgres with RLS as authorization boundary.
- ADR-005: Normalised records instead of user JSON blobs.
- ADR-006: Explicit sharing grants independent of household membership.
- ADR-007: Versioned backup and import format.
- ADR-008: Health-data-safe observability policy.

## 25. Current status

### Completed

- Product prototype and core workflow validation.
- Two-user authentication and per-user prototype state separation.
- Architecture baseline and milestone roadmap.
- Milestone 0 product/compliance discovery baseline: requirements, data map, threat model, accessibility standard, analytics policy, and migration inventory.
- Milestone 1 foundation: strict TypeScript monorepo, web/mobile shells, package boundaries, shared primitives, tests, CI, and verified production builds.
- Milestone 2 identity and security: typed auth/profile contracts, Supabase adapters, confirmation and recovery routes, session-only/durable storage, profile bootstrap, and verified owner-only RLS.
- Milestone 3 local data and sync kernel: account-scoped IndexedDB/SQLite adapters, transactional outbox, idempotent operations, retry and conflict policies, and visible sync state.
- Milestone 4 app shell and settings: adaptive web/mobile navigation, accessible UI primitives, typed settings registry, four appearance modes, account regional/privacy preferences, least-privilege profile persistence, and enforced web bundle budgets.
- Milestones 5–14 product modules: weight, dashboard, nutrition, exercise, habits/wellbeing, explicit partner sharing, notifications/PWA installation, achievements, reports, and versioned backup/import.
- Milestones 15–16 preparation: prototype inventory and migration runbook, GitHub deployment workflow, security headers, database advisor hardening, and commercial-readiness gates.

### Outstanding before commercial beta

- UX research for sharing, calorie targets, and non-judgemental language.
- Separate commercial staging and production Supabase projects.
- Automated end-to-end and visual-regression coverage for critical responsive themes.
- External privacy, accessibility, and security review.

### Known prototype debt

- Global mutable state and direct DOM rendering.
- One large JavaScript module without static types.
- JSON document persistence and last-write-wins sync.
- No automated tests, staged environments, or robust observability.
- Shared feature concepts are not yet modelled as explicit grants.
- SVG icon is not an ideal iOS application icon format.

### Future candidates, not committed scope

- Apple HealthKit and Android Health Connect.
- Barcode scanning and licensed nutrition database.
- Wearable and cycling-platform imports.
- Coach/clinician sharing with consent and audit controls.
- Internationalisation.
- Subscription billing.
- Sandboxed third-party extension SDK.

## 26. Architectural approval record

The product owner approved the architecture and implementation sequence on 2 August 2026, including:

- platform order;
- privacy and sharing model;
- local-first/offline requirement;
- normalised data migration approach;
- milestone sequence and first release scope;
- the rule that the current prototype remains separate until migration is verified.

This document remains living. Every architectural change requires an ADR, an update here, and an explicit effect on milestones, risk, and technical debt.
