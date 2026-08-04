# ADR-004: Supabase and RLS

Status: Accepted.

Supabase Auth and Postgres are the initial system of record. Row Level Security and grants form the authorization boundary for every exposed object. Clients receive publishable keys only. This centralises access rules across web, mobile, realtime, and future clients.
