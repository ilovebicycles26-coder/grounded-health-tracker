# Grounded commercial product

Grounded is a privacy-first, multi-platform personal health product for separate personal accounts and explicitly invited partners.

The existing GitHub Pages application remains a separate live prototype. This repository contains the production-oriented replacement and does not mutate prototype records.

## Current phase

Milestones 0–14 are implemented and verified. The installable responsive PWA includes the dashboard, weight tracking toward 90 kg, nutrition/calories, editable exercise routines, supplements and other habits, private wellbeing, partner invitations with revocable sharing, reminders, achievements, reports, and safe backup/import preview. It is designed for Android and iPhone home-screen installation.

Milestone 15 migration execution and Milestone 16 external assurance are deliberately gated. No personal prototype records move until an isolated staging project, dry-run reconciliation, and Richard/Zoe opt-in exist. See the commercial-readiness and migration runbooks for the exact boundary.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm dev:web
pnpm dev:mobile
```

`pnpm check` runs formatting verification, architecture boundaries, ESLint, strict TypeScript, tests, and production builds for every workspace.

## Documents

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DATA_MAP_AND_RETENTION.md`
- `docs/THREAT_MODEL.md`
- `docs/ACCESSIBILITY_STANDARD.md`
- `docs/ANALYTICS_POLICY.md`
- `docs/PROTOTYPE_MIGRATION_INVENTORY.md`
- `docs/MILESTONE_STATUS.md`
- `docs/QUALITY_REPORT.md`
- `docs/COMMERCIAL_READINESS.md`
- `docs/runbooks/DEPLOYMENT_AND_MOBILE.md`
- `docs/runbooks/PROTOTYPE_BETA_MIGRATION.md`

The governing architecture and roadmap are recorded in `GROUNDED_PRODUCT_BLUEPRINT.md`.
