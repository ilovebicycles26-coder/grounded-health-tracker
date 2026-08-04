# Commercial readiness

Reviewed: 4 August 2026

## Implemented in code

- Strict-TypeScript Clean Architecture monorepo with 25 independently checked packages.
- Separate authentication, account-scoped local databases, offline outbox/sync, and durable optional sign-in.
- Weight tracking toward 90 kg, nutrition diary/calories, editable exercise routines, supplements and other habits, private wellbeing check-ins, achievements, reports, and ZIP backup/import preview.
- Partner invitations with explicit revocable grants; raw weight history, workout notes, food diary, and wellbeing remain private by default.
- Responsive installable PWA for Android and iPhone, quiet/private notification preferences, accessible charts/tables, four display themes, reduced-motion/data controls, CSV and print/PDF reports.
- Normalised Supabase schema, least-privilege grants, RLS, cross-account tests, idempotent sync metadata, and hardened sharing-policy indexes.
- CI quality and GitHub Pages deployment workflows, bundle budget, dependency updates, SPA fallback, CSP, and deployment runbooks.

## Intentionally gated

- Prototype data migration: prepared but no personal records moved without opt-in and reconciliation.
- Commercial production: requires isolated staging/production Supabase projects.
- Native store apps: require signing accounts, store submissions, and on-device QA. The PWA is installable now.
- Desktop packaging: deferred until the web release is stable; a PWA can already be installed on desktop browsers.

## External release gates

- UK GDPR/privacy counsel, DPIA decision, retention schedule, processor agreements, and product terms/privacy notice.
- Medical-device/classification review for any future recommendations or clinical claims.
- Independent WCAG 2.2 AA audit, penetration test, load test, and incident-response exercise.
- Enable Supabase leaked-password protection in the commercial Auth project.
- UX research for calorie targets, sharing comprehension, and non-judgemental language.

This is production-oriented software, but it must not be represented as commercially certified until the external gates above are complete.
