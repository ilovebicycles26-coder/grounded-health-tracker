# ADR-005: Normalised records

Status: Accepted.

Store weight, food, routines, sessions, habits, and wellbeing as constrained relational records, not one JSON document per user. Normalisation enables safe concurrent writes, indexed reporting, migrations, retention rules, and per-resource sharing.
