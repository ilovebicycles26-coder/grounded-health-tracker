# Threat model

Status: Initial STRIDE-based model. Review at every security-sensitive milestone.

## Assets

- Authentication sessions and recovery channels.
- Restricted health records and private notes.
- Identity and sharing relationships.
- Encryption/signing secrets and service credentials.
- User exports and backups.
- Audit integrity and production availability.

## Trust boundaries

- Browser/native client to Supabase APIs.
- Supabase gateway to Auth/Postgres/Storage/Functions.
- Local app process to local database/secure token store.
- User to invited partner.
- Production systems to observability and notification vendors.
- Staff/support tooling to production data.

## Priority threats and controls

| Threat                               | Risk        | Required controls                                                                                          | Verification                                    |
| ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Cross-user record access (IDOR/BOLA) | Critical    | Ownership columns, explicit grants, RLS on every operation, no client-only authorization                   | Negative RLS tests for every table and role     |
| Shared-account data leakage          | Critical    | Separate accounts/stores/caches; household is not access; account-switch teardown                          | E2E switch-account and partner revocation tests |
| Stolen session token                 | High        | TLS, secure storage, short-lived access tokens, refresh rotation, session list/revoke, MFA-ready design    | Auth integration tests and security review      |
| Malicious invite or recovery link    | High        | Random single-purpose tokens, expiry, one-time use, origin/deep-link allowlist, rate limit                 | Link fuzzing and replay tests                   |
| Client contains privileged key       | Critical    | Publishable client key only; service role in trusted runtime/secrets manager                               | Secret scanning and bundle inspection           |
| RLS bypass through functions/views   | Critical    | Security-invoker by default; explicit execute grants; fixed search path; review security-definer functions | Database linter and function permission tests   |
| Offline sync overwrites newer data   | High        | Revisions, idempotency keys, conflict records, tombstones, transactional outbox                            | Deterministic concurrency/property tests        |
| Local data exposed on shared device  | High        | User-scoped DB, secure token store, session-only option, cache clear, OS protections                       | Device/account-switch test matrix               |
| Sensitive telemetry leakage          | High        | Event allowlist, central redactor, no free text/values, consent controls                                   | Automated payload snapshot tests                |
| Malicious backup/import              | High        | Size/type limits, strict schemas, checksums, dry run, transactional import, escaping                       | Fuzz, zip-bomb, formula-injection tests         |
| Stored XSS on web                    | High        | React escaping, no unsafe HTML, CSP, sanitised rich text if introduced                                     | CSP tests and security scanning                 |
| Dependency compromise                | High        | Lockfile, provenance, update policy, audit/SBOM, minimal dependencies                                      | CI scanning and release review                  |
| Brute force/abuse                    | Medium/High | Supabase protections, rate limits, generic auth errors, alerting                                           | Load and abuse tests                            |
| Notification disclosure              | Medium      | Generic lock-screen content, preference, no weight/calorie/note values                                     | Content allowlist tests                         |
| Staff misuse                         | High        | Least privilege, MFA, audited just-in-time access, no routine health browsing                              | Access review and audit drills                  |
| Data loss                            | High        | Managed backups, restore testing, migration rehearsal, local outbox durability                             | Scheduled restore/reconciliation drills         |
| Denial of service/cost abuse         | Medium      | Quotas, pagination, request limits, job budgets, circuit breakers                                          | Load tests and billing alerts                   |

## Security invariants

1. An authenticated user cannot access another user's restricted record without an active matching grant.
2. Revocation blocks the next server request even if a client is stale.
3. A public/publishable key never grants unrestricted data access.
4. Telemetry cannot reconstruct a health diary or identity.
5. Replaying a mutation does not create duplicate health entries.
6. Historical records are not silently rewritten when templates or settings change.
7. Support staff cannot browse health data through ordinary tooling.

## Abuse cases to include in acceptance testing

- Change a record UUID to another user's known UUID.
- Join a household and query every health table without a grant.
- Reuse a revoked invite or sharing token.
- Switch accounts while offline and inspect cached screens.
- Submit the same offline create operation repeatedly.
- Edit and delete the same record concurrently on two devices.
- Import oversized, recursive, malformed, formula-injection, and cross-user data.
- Force logs/errors containing notes, email, tokens, or health values.

## Security review gates

- Threat-model delta at every milestone.
- RLS suite required before any schema reaches staging.
- External penetration test before commercial launch and after material auth/sharing changes.
- Incident response exercise and backup restore evidence before general availability.
