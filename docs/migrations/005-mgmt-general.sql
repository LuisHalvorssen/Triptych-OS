-- Migration 005: allow no-artist management tasks.
--
-- Loosens scope_bucket_match so management tasks can have a null artist —
-- used by the "General" card on /management for cross-artist work
-- (process tasks, team operations, etc.).

alter table public.tasks drop constraint scope_bucket_match;
alter table public.tasks add constraint scope_bucket_match check (
  (scope = 'management' and client_id is null) or
  (scope = 'digital'    and artist is null and client_id is not null) or
  (scope in ('internal', 'media') and artist is null and client_id is null)
);
