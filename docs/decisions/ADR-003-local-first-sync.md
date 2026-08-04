# ADR-003: Local-first synchronisation

Status: Accepted.

Each write commits to a user-scoped local database and transactional outbox before remote synchronisation. Operations are idempotent and revision-aware. TanStack Query coordinates remote status but is not the durable outbox. This protects user input during poor connectivity and prevents silent last-write-wins loss.
