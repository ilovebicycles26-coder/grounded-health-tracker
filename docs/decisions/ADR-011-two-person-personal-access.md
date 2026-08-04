# ADR-011: Two-person personal access

Status: Accepted.

Grounded is a personal application for Richard and Zoe, not a public or commercial product. Only the two accounts that existed when the personal-access migration was applied are allowlisted.

The boundary is enforced in layers: public self-registration is absent from the application, the client checks a caller-bound access function before opening account-scoped local storage, restrictive Postgres RLS policies deny every non-allowlisted account, and sharing RPCs verify the allowlist explicitly. The same boundary covers the original household-based prototype tables and RPCs because they share the Supabase project. Existing owner and explicit-sharing policies continue to isolate Richard's and Zoe's records from each other unless a category is deliberately shared.

The source repository and deployment configuration should remain private. A public static URL may expose downloadable application code, but it must never grant health-data access; access to all personal records is decided by Supabase authentication and database authorization.
