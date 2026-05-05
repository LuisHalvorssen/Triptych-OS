-- Migration 002: tasks.context becomes nullable.
--
-- Tasks scoped to management/digital/media don't have a context tag —
-- the artist (mgmt) or client (digital) IS the bucket. AI categorization
-- now only runs for internal tasks.

alter table public.tasks alter column context drop not null;
