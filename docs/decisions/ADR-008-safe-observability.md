# ADR-008: Health-data-safe observability

Status: Accepted.

Only compile-time allowlisted events and structured safe error codes may leave the client. Health values, identity, tokens, record IDs, and free text are prohibited. A central redactor and payload tests enforce the policy before any observability vendor is integrated.
