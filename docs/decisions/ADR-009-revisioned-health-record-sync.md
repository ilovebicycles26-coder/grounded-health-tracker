# ADR-009: Revisioned feature-owned health records

Status: Accepted — 4 August 2026

## Context

Grounded must accept offline health changes, retry safely, and detect edits made on another device without storing all health domains in one JSON document.

## Decision

Each health feature owns normalised tables and versioned local payloads. Client-generated UUID operation IDs make retries idempotent. Server triggers assign the initial revision, increment revisions atomically, preserve immutable ownership/identity fields, and set authoritative timestamps. Updates include the last observed revision; zero affected rows become explicit conflicts. Deletion uses a tombstone until all devices can observe it.

The first implementation covers `weight_entries` and `weight_goals`. It uses direct PostgREST operations under owner-only RLS rather than a public `SECURITY DEFINER` RPC.

## Consequences

- A fresh device can pull records even when it has nothing to upload.
- Retried operations are acknowledged without applying the mutation twice.
- Concurrent changes are merged only when their fields do not overlap; otherwise the user must decide.
- Every future feature table must repeat the revision, operation ID, tombstone, RLS, grant, index, and cross-account test pattern.
- Cursor pagination currently uses an inclusive `updated_at` boundary. A composite durable cursor is required before high-volume background sync.
