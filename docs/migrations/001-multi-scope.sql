-- Migration 001: Multi-scope rebuild
--
-- Adds three scopes to the task model:
--   internal   — flat list (current behavior)
--   management — tasks bucketed by artist (5-card board)
--   digital    — tasks bucketed by digital_clients row (CRM-lite)
--   media      — placeholder; "Coming Soon" page; no rows yet
--
-- Run order matters. Run section by section, sanity-check counts between sections.
-- All sections are idempotent except where noted.

-- ============================================================
-- SECTION 1 — Pre-flight counts (run first; report numbers back)
-- ============================================================

select context, count(*) as n
from public.tasks
group by context
order by n desc;

-- Expected mapping:
--   MGMT: Wacomo         → scope=management, artist='Wacomo'
--   MGMT: Cam Rao        → scope=management, artist='Cam Rao'
--   MGMT: Baltazar       → scope=management, artist='Baltazar Lora'
--   MGMT: Jev            → scope=management, artist='JEV'
--   MGMT: Yami Club      → scope=management, artist='Yami Club'
--   Digital              → scope=internal (manually re-bucket once digital_clients are seeded)
--   Internal: *          → scope=internal
--   anything else        → scope=internal

-- ============================================================
-- SECTION 2 — Schema: digital_clients table
-- ============================================================

create table if not exists public.digital_clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  analyst             text not null,
  status              text not null default 'active'
                      check (status in ('upcoming', 'active', 'archived')),
  start_date          date,
  end_date            date,
  total_posts_target  int,
  current_posts       int not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  archived_at         timestamptz
);

create index if not exists digital_clients_status_idx on public.digital_clients (status);

alter publication supabase_realtime add table public.digital_clients;

-- ============================================================
-- SECTION 3 — Schema: tasks gain scope + bucket refs
-- ============================================================

alter table public.tasks
  add column if not exists scope     text,
  add column if not exists artist    text,
  add column if not exists client_id uuid references public.digital_clients(id) on delete cascade;

-- Backfill scope from existing context values.
-- Order: management mapping first (overrides the default), then internal default.
update public.tasks
set scope = 'management', artist = 'Wacomo'
where scope is null and context = 'MGMT: Wacomo';

update public.tasks
set scope = 'management', artist = 'Cam Rao'
where scope is null and context = 'MGMT: Cam Rao';

update public.tasks
set scope = 'management', artist = 'Baltazar Lora'
where scope is null and context = 'MGMT: Baltazar';

update public.tasks
set scope = 'management', artist = 'JEV'
where scope is null and context = 'MGMT: Jev';

update public.tasks
set scope = 'management', artist = 'Yami Club'
where scope is null and context = 'MGMT: Yami Club';

-- Everything else (including the generic 'Digital' tag) lands in internal.
-- Old 'Digital' tasks stay tagged with context='Digital' so they're easy
-- to find and manually re-bucket once digital_clients rows are seeded.
update public.tasks
set scope = 'internal'
where scope is null;

-- Now lock it in.
alter table public.tasks
  alter column scope set not null,
  alter column scope set default 'internal',
  add constraint tasks_scope_check
    check (scope in ('internal', 'management', 'digital', 'media')),
  add constraint scope_bucket_match check (
    (scope = 'management' and artist is not null and client_id is null) or
    (scope = 'digital'    and artist is null and client_id is not null) or
    (scope in ('internal', 'media') and artist is null and client_id is null)
  );

create index if not exists tasks_scope_idx on public.tasks (scope);
create index if not exists tasks_artist_idx on public.tasks (artist) where scope = 'management';
create index if not exists tasks_client_id_idx on public.tasks (client_id) where scope = 'digital';

-- ============================================================
-- SECTION 4 — Schema: per-scope Top 3 priorities
-- ============================================================

-- Existing top_priorities rows are all implicitly scope='internal'.
alter table public.top_priorities
  add column if not exists scope text not null default 'internal'
             check (scope in ('internal', 'management', 'digital', 'media'));

-- Repoint PK from (slot) to (scope, slot) so each tab has its own three slots.
alter table public.top_priorities drop constraint top_priorities_pkey;
alter table public.top_priorities add primary key (scope, slot);

-- task_id was UNIQUE globally — relax to UNIQUE per scope so the same task
-- could in theory appear in two scopes' billboards. (In practice a task only
-- has one scope, but the looser constraint matches the new model.)
alter table public.top_priorities drop constraint if exists top_priorities_task_id_key;
create unique index if not exists top_priorities_scope_task_idx
  on public.top_priorities (scope, task_id);

-- ============================================================
-- SECTION 5 — Update swap_priority_slots RPC for per-scope swap
-- ============================================================

drop function if exists public.swap_priority_slots(int, int);

create or replace function public.swap_priority_slots(p_scope text, slot_a int, slot_b int)
returns void as $$
declare
  task_a uuid; task_b uuid; by_a text; by_b text;
begin
  select task_id, pinned_by into task_a, by_a
    from public.top_priorities where scope = p_scope and slot = slot_a;
  select task_id, pinned_by into task_b, by_b
    from public.top_priorities where scope = p_scope and slot = slot_b;
  delete from public.top_priorities
    where scope = p_scope and slot in (slot_a, slot_b);
  if task_a is not null then
    insert into public.top_priorities (scope, slot, task_id, pinned_by)
    values (p_scope, slot_b, task_a, by_a);
  end if;
  if task_b is not null then
    insert into public.top_priorities (scope, slot, task_id, pinned_by)
    values (p_scope, slot_a, task_b, by_b);
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- SECTION 6 — Verification (run last; sanity-check the migration)
-- ============================================================

-- Tasks by scope:
select scope, count(*) as n from public.tasks group by scope order by scope;

-- Management tasks by artist:
select artist, count(*) as n
from public.tasks where scope = 'management'
group by artist order by artist;

-- Any tasks with broken scope/bucket pairing? (Should be zero.)
select id, title, scope, artist, client_id from public.tasks
where (scope = 'management' and artist is null)
   or (scope = 'digital'    and client_id is null)
   or (scope in ('internal', 'media') and (artist is not null or client_id is not null));

-- Top 3 priorities per scope:
select scope, count(*) from public.top_priorities group by scope;
