# ADR-001: Modular monorepo

Status: Accepted.

Use pnpm workspaces and Turborepo. Domain, application, platform adapters, UI, and apps are separate packages with automated import-boundary checks. This shares contracts across platforms while retaining independently testable modules. Microservices are rejected until measured operational needs justify them.
