# Triptych OS — Session Handoff

**Read this first when starting a new Claude session on this project.** It captures everything a fresh agent needs to be productive in 5 minutes instead of re-exploring.

Last updated: 2026-05-05 (Multi-scope rebuild — Internal / Management / Digital / Media)

---

## 0. TL;DR for a fresh Claude session

1. **Project:** Triptych OS — internal task tracker for the Triptych Management team
2. **Live at:** https://tasks.triptychmgmt.com (password-gated: `93Leonard`)
3. **Code:** `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/` — Next.js 16 App Router + TypeScript strict + Supabase + Anthropic (Haiku 4.5)
4. **Repo:** `LuisHalvorssen/Triptych-OS` (public, on GitHub)
5. **Vercel project:** `luishalvorssens-projects/triptych-os` — auto-deploys on push to `main`
6. **Before you edit anything:** read [README.md](../README.md), then this file, then skim [components/AppShell.tsx](../components/AppShell.tsx) (gate + theme + tab nav) and [lib/useScopedTasks.ts](../lib/useScopedTasks.ts) (the shared task/priority state machine). Then read [§8 Hard rules](#8-hard-rules).

The app is now a **four-tab multi-scope tracker**:
- `/internal` — flat list (BD/Legal/Finance/HR/Fundraising). AI-categorized via Anthropic.
- `/management` — five hardcoded artist cards (Baltazar Lora, Wacomo, Cam Rao, Yami Club, JEV). Drag-reorder within a card.
- `/digital` — CRM-lite for Digital clients with metadata (analyst, dates, current/target posts, notes) + per-client task lists. Add new clients inline; expand "Details" panel for inline metadata edit.
- `/media` — "Coming Soon" placeholder.

If the user asks to pick up where we left off, the rebuild from a single tagged-task SPA → four-tab structure is **shipped end-to-end** (verified locally). Outstanding follow-ups are in [§14](#14-suggestions-for-future-work).

---

## 1. Identity

- **App name:** Triptych OS
- **Parent org:** Triptych Management — music/media startup in NYC with three divisions: Management (artist management), Digital (TripFlow fan-account automation), Internal
- **Team (hardcoded):** Jon, Luis, Aidan, Liam
- **Brand color:** `#2C3BD3` (Triptych Blue — used for wordmark + accents)
- **Purpose:** lightweight shared task tracker, scoped per division

---

## 2. Stack

- **Framework:** Next.js `16.2.4` (App Router, Turbopack-based builds)
- **Language:** TypeScript `^5.6.2` (strict mode, no `any`)
- **Styling:** CSS variables + inline styles + Tailwind `3.4.13` (tailwind is underused — most styling is via CSS vars in `globals.css` and inline style objects)
- **DB + Realtime:** Supabase (`@supabase/supabase-js ^2.45.4`)
- **AI:** Anthropic SDK `^0.32.1`, model `claude-haiku-4-5`, `max_tokens: 60`. **Used by `/internal` only.** Management and Digital scopes don't need categorization (the bucket IS the category).
- **Linter:** ESLint `9.39.4` + `eslint-config-next 16.2.4` (flat config in [eslint.config.mjs](../eslint.config.mjs))
- **Hosting:** Vercel (auto-deploy on push to `main`)
- **Domain:** `tasks.triptychmgmt.com` → Vercel via A-record `76.76.21.21` at GoDaddy

---

## 3. Where things live

| What | Where |
|---|---|
| Source code | `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/` |
| Repo | https://github.com/LuisHalvorssen/Triptych-OS |
| Production URL | https://tasks.triptychmgmt.com |
| Vercel dashboard | https://vercel.com/luishalvorssens-projects/triptych-os |
| Supabase project | `wpsprumpwklpwdgffgyr` at https://wpsprumpwklpwdgffgyr.supabase.co |
| Supabase tables | `public.tasks`, `public.top_priorities`, `public.digital_clients` (all in `supabase_realtime` publication) |
| **SQL migrations** | `docs/migrations/001-multi-scope.sql`, `002-context-nullable.sql`, `003-task-position.sql` — run in order in the Supabase SQL editor |
| Anthropic console | https://console.anthropic.com |
| GoDaddy DNS | `triptychmgmt.com` registered at GoDaddy; `tasks` A-record → `76.76.21.21` |
| CI | `.github/workflows/ci.yml` — runs typecheck + lint + build on every push/PR |

---

## 4. Environment variables

All four are required in production. Server-only ones (no `NEXT_PUBLIC_` prefix) never ship to the browser.

| Name | Surface | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase anon JWT (shipped to clients by design) |
| `ANTHROPIC_API_KEY` | server only (`/api/categorize`) | Claude API key — only `/internal` calls categorize |
| `GATE_PASSWORD` | server only (middleware + `/api/gate`) | Shared team password; currently `93Leonard` |

⚠️ **Anthropic key was leaked in chat early in the project's life.** Rotate at https://console.anthropic.com/settings/keys when convenient. Still pending.

---

## 5. Supabase schema

```sql
-- Tasks: now scoped. Bucket fields are mutually exclusive per the
-- scope_bucket_match constraint.
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  owner      text not null,                 -- 'Jon' | 'Luis' | 'Aidan' | 'Liam'
  context    text,                          -- nullable; only set for scope='internal' (the AI tag)
  status     text not null default 'Todo',  -- 'Todo' | 'Done'
  created_at timestamptz not null default now(),

  scope      text not null default 'internal'
             check (scope in ('internal', 'management', 'digital', 'media')),
  artist     text,                          -- one of ARTISTS when scope='management'
  client_id  uuid references digital_clients(id) on delete cascade,
  position   double precision,              -- explicit order key for /management + /digital; null on /internal

  constraint scope_bucket_match check (
    (scope = 'management' and artist is not null and client_id is null) or
    (scope = 'digital'    and artist is null and client_id is not null) or
    (scope in ('internal', 'media') and artist is null and client_id is null)
  )
);

-- Per-scope Top 3 priorities. PK is (scope, slot) so each tab has its own
-- 3-slot billboard. unpin_on_done trigger still applies (carried over from v1).
create table public.top_priorities (
  scope      text not null
             check (scope in ('internal','management','digital','media')),
  slot       int  not null check (slot in (1,2,3)),
  task_id    uuid not null references tasks(id) on delete cascade,
  pinned_at  timestamptz not null default now(),
  pinned_by  text not null,
  primary key (scope, slot)
);
create unique index top_priorities_scope_task_idx on top_priorities (scope, task_id);

-- Digital clients — CRM-lite roster.
create table public.digital_clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  analyst             text not null,           -- one of DIGITAL_ANALYSTS
  status              text not null default 'active'
                      check (status in ('upcoming','active','archived')),
  start_date          date,
  end_date            date,
  total_posts_target  int,
  current_posts       int not null default 0,  -- v3: will be API-synced; stays editable as fallback
  notes               text,
  created_at          timestamptz not null default now(),
  archived_at         timestamptz
);

-- Per-scope swap RPC. Replaces the old single-scope swap_priority_slots(int,int).
create or replace function public.swap_priority_slots(p_scope text, slot_a int, slot_b int)
returns void as $$
declare task_a uuid; task_b uuid; by_a text; by_b text;
begin
  select task_id, pinned_by into task_a, by_a
    from top_priorities where scope = p_scope and slot = slot_a;
  select task_id, pinned_by into task_b, by_b
    from top_priorities where scope = p_scope and slot = slot_b;
  delete from top_priorities where scope = p_scope and slot in (slot_a, slot_b);
  if task_a is not null then
    insert into top_priorities (scope, slot, task_id, pinned_by) values (p_scope, slot_b, task_a, by_a);
  end if;
  if task_b is not null then
    insert into top_priorities (scope, slot, task_id, pinned_by) values (p_scope, slot_a, task_b, by_b);
  end if;
end;
$$ language plpgsql security definer;

-- Realtime publication includes all three tables.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.top_priorities;
alter publication supabase_realtime add table public.digital_clients;
```

**Position semantics:** `tasks.position` is sorted **ascending** (smaller = top of list). New tasks on `/management` and `/digital` get `(min existing in bucket) - 1` so they appear at top. Reorders insert between two positions by averaging them. Floating-point splits are fine for the current task volumes; if precision becomes an issue, write a renumber RPC.

**RLS posture:** still effectively permissive. The anon key can read/insert/update/delete all rows. Safe today *only because* the entire site sits behind the `GATE_PASSWORD` middleware. If you remove the gate or expose the anon key publicly, migrate to proper RLS policies.

---

## 6. Architecture at a glance

```
app/
  layout.tsx                  fonts + viewport + wraps children with <AppShell>
  page.tsx                    server component; redirects to /<last-tab cookie> or /internal
  globals.css                 CSS vars (dark/light), all component styles
  gate/page.tsx               password prompt UI (client component)
  api/categorize/route.ts     server proxy to Anthropic — only /internal calls this
  api/gate/route.ts           password check → sets HttpOnly cookie (edge runtime)

  internal/page.tsx           current SPA (TaskInput + TopPriorities + TaskList) — uses useScopedTasks('internal')
  management/page.tsx         5 artist cards (ArtistCard) — uses useScopedTasks('management')
  digital/page.tsx            client roster (ClientCard + NewClientForm) — uses useScopedTasks('digital')
  media/page.tsx              ScopePlaceholder "Coming soon"

middleware.ts                 gates every route behind GATE_PASSWORD cookie

components/
  AppShell                    Hoisted shared shell. Reads cookies, gates on hydrated/configured/user,
                              renders Header + children + Toaster. Provides {currentUser, theme} via
                              useApp() hook. Persists last-tab cookie via usePathname effect.
  Header                      Sticky top: brand row (avatars + theme toggle) + 4-tab nav row.
                              Active tab highlighted via accent-blue underline.
  TaskInput                   Internal-only: owner select + text input + ADD button + AI fetch.
  TaskList                    Internal-only: filter bar (owner / context / active|closed) + rows.
  TaskRow                     Shared row: checkbox, owner dot, title, date, tag pill (gated on
                              context !== null), pin (☆/★), edit (✎), delete (×), swipe gestures.
  TopPriorities               Per-scope 3-slot billboard. Drag-reorder (desktop) + chevrons (mobile).

  ArtistCard                  /management card. Header (name + count) + always-visible task input
                              + TaskListDnD. New tasks land at top; reorder DnD within card.
  ClientCard                  /digital card. Summary row (name, analyst, dates, current/target,
                              days-remaining, count, "Details" toggle). Tasks + task input ALWAYS
                              visible below the summary (regardless of metadata panel state).
                              "Details" toggle reveals ClientMetaEditor (inline blur-commit edits)
                              + Archive button.
  NewClientForm               /digital — inline form opened via "+ New client" button. All fields
                              optional except name + analyst + status (defaults: active, first analyst).
  TaskListDnD                 Reusable drag-reorder list. Renders TaskRow inside <li draggable>.
                              Drop indicator via ::before/::after CSS; insert position computed from
                              cursor Y inside the row (upper half = above, lower half = below).
                              Cross-list moves are a no-op by design.
  ScopePlaceholder            Big-title centered card. Currently used by /media.

  UserSelector                first-load "who are you?" screen
  ConfigMissing               fallback when env vars aren't set
  Toaster                     fixed bottom-center toast stack (error/success/info/action variants)

lib/
  useScopedTasks.ts           Shared task + priority state machine. Loads tasks + priorities filtered
                              by scope, subscribes to per-scope realtime channels (tasks-${scope},
                              priorities-${scope}). Returns mutations (toggle, update, pin, reorder
                              priorities, soft-delete with 4s undo). Each page wraps `setTasks`
                              with its own create handler — different scopes have different insert
                              payloads.
  constants.ts                TEAM, ARTISTS, DIGITAL_ANALYSTS, SCOPES, SCOPE_LABEL, OWNER_COLORS,
                              TAGS (legacy — internal only), DEFAULT_TAG, USER_COOKIE,
                              LAST_TAB_COOKIE.
  types.ts                    Task, DigitalClient, TopPriority, Scope, Artist, DigitalAnalyst,
                              DigitalClientStatus, TeamMember, etc.
  cookies.ts                  triptych-user, triptych-last-tab read/write + isValidScope guard
  supabase.ts, theme.ts, toast.ts, gate.ts, useSwipe.ts  — unchanged from v1
```

### Data flow (any scope)

1. Page mounts `useScopedTasks(scope)`. The hook fetches `tasks` and `top_priorities` filtered by `scope=eq.${scope}`, subscribes to two realtime channels with the same filter.
2. User input flows through page-level handlers (`handleCreate*` and the mutations returned from the hook). All Supabase writes go through these handlers — components never call Supabase directly.
3. Optimistic updates with rollback on failure. Realtime events from other clients merge into local state (dedup by id for tasks, by slot for priorities).
4. Task ordering: `/internal` sorts by `created_at desc`; `/management` and `/digital` sort by `position asc`.

---

## 7. Accounts & auth state

(Unchanged from v1.)

- **GitHub:** `gh auth status` shows both `LuisHalvorssen` (active) and `LHalvorssen` logged in. Repo owned by `LuisHalvorssen`.
- **Vercel:** CLI logged in as `luishalvorssen`. Team: `luishalvorssens-projects`.
- **Git commit identity:** local git config is `LHalvorssen <LuisHalvorssen@gmail.com>`. Recognized by the `luishalvorssen` Vercel account via secondary email.
- **Repo visibility:** public (no secrets in source).

---

## 8. Hard rules

Violating any of these is a regression.

1. **No `any` types.** TypeScript strict mode; use `unknown` + narrowing when a type is genuinely unknown.
2. **All Supabase writes flow through page-level handlers.** Components receive `onX` props and never import `supabase` directly. Optimistic update + rollback pattern.
3. **`scope_bucket_match` constraint** — the DB enforces that `scope='management'` ⇒ `artist` set, `client_id` null; `scope='digital'` ⇒ `client_id` set, `artist` null; `scope` in {`internal`,`media`} ⇒ both null. Inserts must respect this. Cross-scope moves (changing a task's scope) are not currently supported by any UI.
4. **AI categorization runs only on `/internal`.** Management/Digital task inserts must pass `context: null`. Don't reintroduce the categorize call elsewhere.
5. **The `ARTISTS` list is hardcoded** in `lib/constants.ts` (5 names). Order in that array drives left-to-right card order on `/management`. Adding/removing an artist requires editing the constant + (optionally) cleaning up orphaned tasks via SQL.
6. **`DIGITAL_ANALYSTS` is also hardcoded** — adding a new analyst means editing the constant.
7. **Env vars with `NEXT_PUBLIC_` prefix ship to the browser.** Anything secret must not use that prefix.
8. **The password gate is the only thing protecting Supabase data.** Don't bypass, remove, or commit `GATE_PASSWORD`.
9. **The Sacred Flow (`/internal`):** log on → pick owner → type → enter → see it appear. Don't add required fields or modals before submit.
10. **Task position is ascending** (smaller = top). New tasks on `/management` and `/digital` get `min - 1`. Reorders average neighbors. Don't accidentally flip the sort direction.
11. **Before pushing:** run `npm run lint && npx tsc --noEmit && npm run build`. CI will catch regressions, but ship verified.
12. **Commit messages:** multi-line format with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## 9. History — multi-scope rebuild (2026-05-05)

The codebase was migrated from a single tagged-task SPA to a four-tab structure in one session. Migrations are idempotent and live in `docs/migrations/`:

- **001-multi-scope.sql** — adds `scope`, `artist`, `client_id` columns; creates `digital_clients`; backfills management tasks via the old `MGMT: <name>` tags; reshapes `top_priorities` to `(scope, slot)` PK; replaces `swap_priority_slots` with the per-scope variant.
- **002-context-nullable.sql** — drops `NOT NULL` on `tasks.context` so management/digital tasks can be inserted without a tag.
- **003-task-position.sql** — adds `position double precision` for explicit ordering on management/digital cards. Backfills management tasks with `-extract(epoch from created_at)` (newest = top).

The legacy 13-prompt UX work stream (mobile responsive, hover/touch, typography, card contrast, tag colors, completion animation, enter-to-submit, inline-edit fix, undo toast, dark-mode contrast, header polish) all shipped pre-rebuild and is preserved. The two outstanding prompts (12 — command palette, 13 — keyboard shortcuts) were **not** built; they're now lower priority given the multi-scope shape change.

---

## 10. Known outstanding work (non-UX)

- **Rotate the Anthropic API key** (still pending). https://console.anthropic.com/settings/keys → revoke + generate → update `.env.local` + `vercel env rm/add ANTHROPIC_API_KEY production` → redeploy.
- **RLS migration.** Same posture as v1; required if you ever remove the gate or expose the anon key publicly.
- **V3: Digital current_posts API sync.** `digital_clients.current_posts` is a normal editable column today. When the upstream API integration is built, an external sync job should `UPDATE` that column on a schedule; realtime will push the changes to all open browsers automatically. The manual edit input in `ClientCard` stays as a fallback override.
- **Digital tasks still tagged with `context='Digital'`.** The 18 tasks that were `Digital`-tagged in v1 landed in `scope='internal'` with the original tag intact. They need to be manually re-bucketed to specific clients once the user creates real `digital_clients` rows from the audit (Mt.Joy, Lila Drew, Shav, Claire Brooks, Borderline, etc.).
- **`top_priorities.task_id` is no longer globally unique** — relaxed to unique-per-scope. In practice each task has one scope, so this won't matter.

---

## 11. Common ops commands

(Run from `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/`. Unchanged from v1 — see git history for the v1 list. Key additions: SQL migrations are run via the Supabase SQL editor at https://supabase.com/dashboard/project/wpsprumpwklpwdgffgyr/sql/new.)

---

## 12. Known quirks / gotchas

- **TaskRow is shared across all three task-bearing scopes.** It renders the context tag pill only when `task.context` is non-null — that's how we hide the pill on management/digital rows without a separate component.
- **Cross-list DnD is a no-op.** Dragging a task from one ArtistCard to another (or from one ClientCard to another) does nothing — `TaskListDnD` filters out drags for tasks not in its current list. If you ever want cross-list moves, add an explicit "move to artist X" UI on TaskRow rather than relying on DnD.
- **DnD drop index is held in a ref, not just state**, so synchronous event sequences (programmatic drops in tests, very fast user drops) read the latest value. State is still updated for the visible drop indicator.
- **Inline metadata edits commit on `blur`.** If you set a value programmatically without firing focus/blur, the patch won't run. Real users hit blur naturally when tabbing or clicking out.
- **`current_posts` and `total_posts_target` are integers.** Empty string in the input → `null` (target) or `0` (current).
- **Mt. Joy test client** may still be in your DB from rebuild verification. SQL to wipe: `delete from public.digital_clients where name = 'Mt. Joy';` (cascades to tasks).
- **The `Header` has 2 rows:** a `.app-header-row` for brand + avatars + theme toggle, and a `.app-header-tabs` strip below. Mobile shrinks both.
- **Position-collision race on rapid create.** `handleCreateTask` in `/digital` and `/management` reads `visibleTasks` from closure to compute `min - 1`. Two creates fired inside a single React batch (effectively impossible by hand) would both compute the same position. Sort order between equal-position tasks is undefined. If this ever bites, switch to a ref-read or use a server-side `default position = (select min - 1 ...)`.
- **`ClientMetaEditor` uses `defaultValue`.** Inputs don't refresh from realtime updates — if user A edits a field while user B has the Details panel open, B keeps seeing the value at panel-open time. The summary row (read from `client` prop) does update live. Acceptable for 4-person team; not for public scale.
- **Mobile DnD is a no-op.** HTML5 drag events don't fire on touch. Reorder on `/management` and `/digital` is desktop-only. Mobile users on those pages can still create, edit, complete, and pin — just not reorder.
- **Floating-point position precision.** Each reorder split halves the gap. After ~50 reorders in the same neighborhood, you'll hit 1e-15 territory. Write a renumber RPC then.

---

## 13. Recent commit log

```
(pending) Multi-scope rebuild — Internal/Management/Digital/Media tabs, shared
          AppShell + useScopedTasks hook, ArtistCard + ClientCard + TaskListDnD,
          per-scope Top 3 billboard, position-based reordering. Migrations 001-003.
973c1a1   Fix: checkbox vertically centered with the rest of the row
64102a8   Prompt 11: Header bar + avatar polish
95dd507   Prompt 10: Dark-mode contrast pass
f6d8b48   Prompt 09: Soft-delete with 4s undo window
bb44909   Prompt 08: Inline edit truncation fix + edit-mode polish
3bca50f   Update SESSION-CONTEXT through Prompt 07 + Top 3 Priorities
092dbcc   Prompt 07: Form submission, focus accent, and input polish
b2ab16e   Prompt 06: Task completion animation + undo toast
cbcd157   Prompt 05: Color system for context tags
5f31f69   Add Top 3 priorities billboard
... (earlier history unchanged)
```

---

## 14. Suggestions for future work

### High value, low effort

1. **Wipe Mt. Joy test data.** `delete from public.digital_clients where name = 'Mt. Joy';`.
2. **Backfill real Digital clients** from the audit: Mt.Joy / Lila Drew / Shav / Claire Brooks / Borderline (active) and Bebe Rexha / Luke Chiang / Jonny Stanback / Dualtone / Cody Simpson (upcoming). Manually re-bucket the 18 `Digital`-tagged tasks from `/internal` once those rows exist.
3. **Rotate the Anthropic API key** (still leaked from earlier session).
4. **Validate `/api/categorize` response with zod** — currently `as`-cast to `CategorizeResponse`.
5. **Per-tab page titles.** Currently all four tabs say "Triptych OS"; setting `title` per route would help browser history.

### Refactors worth doing eventually

6. **Extract per-card task state into a `useBucketTasks(filter)` hook.** ArtistCard and ClientCard both maintain their own task input state and call onCreate; same shape, could share.
7. **Mobile reorder UX.** HTML5 DnD doesn't work on touch. Today the mobile users can't reorder management/digital tasks. Add long-press + ▲▼ handles or a per-row "move to" picker.
8. **Floating-point precision on positions.** Each split halves the gap; after ~50 reorders in the same neighborhood you'll hit 1e-15 territory. Add a renumber RPC that rewrites positions to integers when the gap shrinks below a threshold.
9. **Inline-styles → CSS Modules.** Most components still use inline-style objects. Working but defeats Tailwind's tree-shaking.
10. **Slim the Supabase client bundle.** We don't use auth or storage — only PostgREST + realtime.

### V3 (planned externally)

11. **Digital current_posts API sync.** Pipe an external API into the `digital_clients.current_posts` column on a schedule. No frontend change required — realtime + the existing render path already handle it.

### Things that would be net-negative right now

- **Cross-scope task moves.** Tasks moving between `internal` ↔ `management` ↔ `digital` would require touching the bucket fields atomically. Almost never useful — easier to delete + recreate.
- **Per-route page-level realtime aggregation.** Each tab subscribes only to its own scope's tasks. Don't try to share a single realtime channel across pages — the per-scope filter is what makes the rebuild fast.

---

**If this doc gets out of date, ask the active Claude to update it. The file is meant to travel with the repo and evolve with the work.**
