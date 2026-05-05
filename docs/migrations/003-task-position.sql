-- Migration 003: tasks gain a `position` column for explicit ordering.
--
-- Used by the Management page so users can drag-reorder tasks within an
-- artist card. Smaller position = higher in the list. New tasks get
-- (min position in artist) - 1 so they appear at the top.
--
-- Internal tasks don't currently use this column (they sort by created_at);
-- the column is nullable and ignored there.

alter table public.tasks add column if not exists position double precision;

update public.tasks
set position = -extract(epoch from created_at)
where scope = 'management' and position is null;

create index if not exists tasks_artist_position_idx
  on public.tasks (artist, position) where scope = 'management';
