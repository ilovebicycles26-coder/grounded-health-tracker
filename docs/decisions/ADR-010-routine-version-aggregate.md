# ADR-010: Versioned routine aggregate

Status: Accepted, 4 August 2026

## Decision

An editable exercise routine is one consistency boundary. Its ordered steps are stored together as validated JSONB in a versioned `exercise_routines` row, while completed sessions remain separate relational records containing historical snapshots.

## Why

The full routine must be saved atomically during offline sync. A partially updated ordered step list would be unsafe and confusing. This is a bounded aggregate, not a user-wide JSON document: ownership, versions, sessions, indexes, retention, and sharing remain explicit relational concepts. Once a routine has history, editing creates a new version instead of rewriting that history.

## Consequences

- Step-level analytics require deliberate JSONB projection or a future read model.
- The application validates every step and the database validates array shape and size.
- Sharing grants refer to routine families or versions without exposing workout notes.
