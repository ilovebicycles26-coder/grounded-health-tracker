# ADR-007: Versioned backups

Status: Accepted.

Use a documented, versioned archive with manifest, checksums, and entity streams. Imports validate and dry-run before confirmation. This supports data portability and safe schema evolution without coupling users to an internal database dump.
