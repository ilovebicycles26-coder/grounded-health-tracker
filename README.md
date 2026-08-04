# Grounded personal health tracker

Grounded is Richard and Zoe's private-use, multi-platform health tracker. It supports separate personal accounts and explicit, revocable partner sharing.

The GitHub Pages address is publicly reachable because that is how GitHub Pages works on this repository, but the application and database are allowlisted to Richard and Zoe's two existing accounts. Opening the sign-in screen does not grant access to health data.

## Current phase

Milestones 0–14 are implemented and verified. The installable responsive PWA includes the dashboard, weight tracking toward 90 kg, nutrition/calories, editable exercise routines, supplements and other habits, private wellbeing, partner invitations with revocable sharing, reminders, achievements, reports, and safe backup/import preview. It is designed for Android and iPhone home-screen installation.

The personal-access migration is live. Public registration has been removed from the application, and restrictive database policies deny non-allowlisted accounts across both the current application and the original prototype schema.

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
