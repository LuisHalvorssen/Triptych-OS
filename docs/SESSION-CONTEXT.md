# Triptych OS — Session Handoff

**Read this first when starting a new Claude session on this project.** It captures everything a fresh agent needs to be productive in 5 minutes instead of re-exploring.

Last updated: 2026-04-28

---

## 0. TL;DR for a fresh Claude session

1. **Project:** Triptych OS — internal task tracker for the 4-person Triptych Management team
2. **Live at:** https://tasks.triptychmgmt.com (password-gated: `93Leonard`)
3. **Code:** `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/` — Next.js 16 App Router + TypeScript strict + Supabase + Anthropic (Haiku 4.5)
4. **Repo:** `LuisHalvorssen/Triptych-OS` (public, on GitHub)
5. **Vercel project:** `luishalvorssens-projects/triptych-os` — auto-deploys on push to `main`
6. **Before you edit anything:** read [README.md](../README.md), then this file, then skim [app/page.tsx](../app/page.tsx). Then read the section [§8 Hard rules](#8-hard-rules).

If the user asks to pick up where we left off, the current work stream is **UI/UX improvements via a sequence of 13 `.md` prompts** (see [§9](#9-current-work-stream)). Prompts 01-07 are done; prompt 08 (inline edit fix) is next. The Top 3 Priorities billboard (a feature add, not a prompt) shipped between prompts 04 and 05 — see [§9b](#9b-top-3-priorities).

---

## 1. Identity

- **App name:** Triptych OS
- **Parent org:** Triptych Management — music/media startup in NYC with three divisions: Management (artist management), Digital (TripFlow fan-account automation), Internal
- **Team (hardcoded):** Jon, Luis, Aidan, Liam
- **Brand color:** `#2C3BD3` (Triptych Blue — used for wordmark + accents)
- **Purpose:** lightweight shared task tracker with AI-assigned context tags

---

## 2. Stack

- **Framework:** Next.js `16.2.4` (App Router, Turbopack-based builds)
- **Language:** TypeScript `^5.6.2` (strict mode, no `any`)
- **Styling:** CSS variables + inline styles + Tailwind `3.4.13` (tailwind is underused — most styling is via CSS vars in `globals.css` and inline style objects)
- **DB + Realtime:** Supabase (`@supabase/supabase-js ^2.45.4`)
- **AI:** Anthropic SDK `^0.32.1`, model `claude-haiku-4-5`, `max_tokens: 60`, ~$0.0007/task
- **Linter:** ESLint `9.39.4` + `eslint-config-next 16.2.4` (flat config in [eslint.config.mjs](../eslint.config.mjs))
- **Hosting:** Vercel (auto-deploy on push to `main`)
- **Domain:** `tasks.triptychmgmt.com` → Vercel via A-record `76.76.21.21` at GoDaddy

---

## 3. Where things live

| What | Where |
|---|---|
| Source code | `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/` |
| Repo | https://github.com/LuisHalvorssen/Triptych-OS (public) |
| Production URL | https://tasks.triptychmgmt.com |
| Vercel dashboard | https://vercel.com/luishalvorssens-projects/triptych-os |
| Vercel deployments | https://vercel.com/luishalvorssens-projects/triptych-os/deployments |
| Vercel env vars | https://vercel.com/luishalvorssens-projects/triptych-os/settings/environment-variables |
| Supabase project | `wpsprumpwklpwdgffgyr` at https://wpsprumpwklpwdgffgyr.supabase.co |
| Supabase table | `public.tasks` (Realtime enabled via `supabase_realtime` publication) |
| Anthropic console | https://console.anthropic.com |
| GoDaddy DNS | `triptychmgmt.com` registered at GoDaddy; `tasks` A-record → `76.76.21.21` |
| CI | `.github/workflows/ci.yml` — runs typecheck + lint + build on every push/PR |
| UI/UX prompts | `/Users/luishalvorssen/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/triptych-os-improvements/` (files `01-...md` through `13-...md`) |

---

## 4. Environment variables

All four are required in production. Server-only ones (no `NEXT_PUBLIC_` prefix) never ship to the browser.

| Name | Surface | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase anon JWT (shipped to clients by design) |
| `ANTHROPIC_API_KEY` | server only (`/api/categorize`) | Claude API key |
| `GATE_PASSWORD` | server only (middleware + `/api/gate`) | Shared team password; currently `93Leonard` |

Local dev: values live in `.env.local` (gitignored). Vercel prod: set via `vercel env add` or the dashboard.

⚠️ **The Anthropic API key that's currently active was pasted into chat in an earlier session — strongly recommend rotating it at https://console.anthropic.com/settings/keys when convenient. Not yet done.**

---

## 5. Supabase schema

```sql
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  owner      text not null,    -- one of: 'Jon' | 'Luis' | 'Aidan' | 'Liam'
  context    text not null,    -- one of the 11 tags in lib/constants.ts TAGS[]
  status     text not null default 'Todo',  -- 'Todo' | 'Done'
  created_at timestamptz not null default now()
);

-- Top 3 priorities billboard. Three-slot ranked pin list shared by all
-- users; ignores all owner/context filters. PK on slot hard-caps to 3.
-- task_id unique prevents pinning the same task twice. ON DELETE CASCADE
-- frees the slot when a task is deleted.
create table public.top_priorities (
  slot       int  primary key check (slot in (1, 2, 3)),
  task_id    uuid not null unique references public.tasks(id) on delete cascade,
  pinned_at  timestamptz not null default now(),
  pinned_by  text not null
);

-- Trigger that drops a task from the billboard the moment its status
-- flips to Done. Keeps the billboard focused on active work even when
-- a task is closed via swipe, undo toast, or direct SQL.
create or replace function public.unpin_on_done()
returns trigger as $$
begin
  if NEW.status = 'Done' and OLD.status <> 'Done' then
    delete from public.top_priorities where task_id = NEW.id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger unpin_done_trigger
  after update of status on public.tasks
  for each row execute function public.unpin_on_done();

-- Atomic slot swap RPC for reorder-within-billboard. Handles both
-- swap (both slots occupied) and move-to-empty (one slot empty).
-- Called from app/page.tsx via supabase.rpc("swap_priority_slots", ...).
create or replace function public.swap_priority_slots(slot_a int, slot_b int)
returns void as $$
declare
  task_a uuid; task_b uuid; by_a text; by_b text;
begin
  select task_id, pinned_by into task_a, by_a from public.top_priorities where slot = slot_a;
  select task_id, pinned_by into task_b, by_b from public.top_priorities where slot = slot_b;
  delete from public.top_priorities where slot in (slot_a, slot_b);
  if task_a is not null then
    insert into public.top_priorities (slot, task_id, pinned_by) values (slot_b, task_a, by_a);
  end if;
  if task_b is not null then
    insert into public.top_priorities (slot, task_id, pinned_by) values (slot_a, task_b, by_b);
  end if;
end;
$$ language plpgsql security definer;

-- Realtime: both tables are in the supabase_realtime publication
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.top_priorities;
```

**RLS posture:** effectively permissive. The anon key can read/insert/update/delete all rows. This is safe today *only because* the entire site sits behind the `GATE_PASSWORD` middleware. If you ever remove the gate or expose the anon key publicly, you must migrate to proper RLS policies (see §10).

---

## 6. Architecture at a glance

```
app/
  layout.tsx                 fonts (Syne + IBM Plex Mono), viewport meta (viewport-fit=cover)
  page.tsx                   SPA root. Owns task state + ALL mutation handlers.
  globals.css                CSS variables (dark/light), responsive helpers, breakpoints
  gate/page.tsx              password prompt UI (client component)
  api/categorize/route.ts    server proxy to Anthropic (nodejs runtime)
  api/gate/route.ts          password check → sets HttpOnly cookie (edge runtime)

middleware.ts                gates every route behind GATE_PASSWORD cookie

components/
  Header                     sticky top bar: wordmark + avatars + theme toggle
  TaskInput                  owner select (with chevron) + text input + ADD button.
                             Wrapped in <form onSubmit>. Orange focus accent on field.
  TopPriorities              ranked 3-slot billboard between input and list. Drag-and-drop
                             reorder on desktop; ▲▼ chevrons on mobile (gated by hover:none).
  TaskList                   filter bar (owner/context/tab) + row list + empty state.
                             Wrapped in .task-list-card surface with shadow + radius.
  TaskRow                    row: checkbox, owner, title, date, tag pill, pin (☆/★),
                             delete (×), swipe-right-to-complete on touch. Owns the
                             completion animation and the .task-row-new enter animation.
  UserSelector               first-load "who are you?" screen
  ConfigMissing              fallback when env vars aren't set
  Toaster                    fixed bottom-center toast stack. error/success/info pills,
                             plus an "action" variant (dark pill, embedded undo button).

lib/
  constants.ts               TEAM, TAGS, OWNER_COLORS, STATUS_CONFIG, tagStyle() (theme-
                             aware, reads data-theme at render), tagShortName() for the
                             mobile name swap, plus the per-tag light/dark color map.
  types.ts                   Task, Status, ContextTag, TeamMember, CategorizeResponse,
                             SlotNumber (1|2|3), TopPriority
  supabase.ts                singleton client + missingSupabaseEnvVars[]
  cookies.ts                 triptych-user cookie read/write
  theme.ts                   triptych-theme cookie read/write + applyTheme()
  toast.ts                   module-level toast store + useToasts() hook. Variants:
                             error / success / info / action (with {label, onClick}).
  gate.ts                    SHA-256 gate-token helpers (used by middleware + /api/gate)
  useSwipe.ts                touch-only left/right swipe gesture hook (threshold 100px,
                             aborts on >30px Y drift to preserve native scroll)
```

**Data flow:**
1. On mount, `app/page.tsx` reads cookies (user, theme), fetches tasks + top_priorities from Supabase, subscribes to two Realtime channels (`tasks-realtime`, `priorities-realtime`)
2. User input flows through handlers defined in `page.tsx` that do optimistic state updates + Supabase calls. Same pattern for tasks (toggle/title/owner/context/delete) and priorities (pin/unpin/reorder)
3. On Supabase failure, state rolls back and an error toast appears
4. Realtime events from other clients merge into local state (dedup by id for tasks, by slot for priorities)
5. Completing a task fires the local `triggerComplete` chain in TaskRow: 600ms animation → onToggleDone(true) → toast.action("Task completed") with undo. The unpin-on-Done DB trigger frees the billboard slot if the completed task was pinned

---

## 7. Accounts & auth state

- **GitHub:** `gh auth status` shows both `LuisHalvorssen` (active) and `LHalvorssen` logged in. Repo is owned by `LuisHalvorssen`.
- **Vercel:** CLI logged in as `luishalvorssen`. Team: `luishalvorssens-projects`. Owner email: `luis@triptychmgmt.com` (primary), `luishalvorssen@gmail.com` (secondary, verified).
- **Git commit identity:** local git config is `LHalvorssen <LuisHalvorssen@gmail.com>`. This identity is recognized by the `luishalvorssen` Vercel account via the secondary email, so auto-deploys work.
- **Repo visibility:** public. Was briefly private, but Vercel Hobby plan blocks private-repo deploys when the git commit author isn't the project owner. The repo contains no secrets (env vars are Vercel-only, `.env.local` is gitignored). Leaving public avoids that friction.

---

## 8. Hard rules

Violating any of these is a regression. Every past Claude session has respected them.

1. **No `any` types.** TypeScript strict mode; use `unknown` + narrowing when a type is genuinely unknown.
2. **All Supabase writes flow through handlers in `app/page.tsx`.** Components receive `onX` props and never import `supabase` directly. This keeps local state and DB state in sync (optimistic updates + rollback on failure).
3. **The tag list lives in THREE places and they must stay in sync:**
   - `lib/types.ts` — the `ContextTag` union
   - `lib/constants.ts` — the `TAGS` array
   - `app/api/categorize/route.ts` — the list in the Anthropic prompt
   If you add/rename/remove a tag, touch all three. Otherwise validation silently falls back to `"Internal: BD"`.
4. **Env vars with `NEXT_PUBLIC_` prefix ship to the browser.** Anything secret (Anthropic key, gate password) must not use that prefix. Currently correct; don't change.
5. **The password gate (`middleware.ts`) is the only thing protecting the Supabase data.** Do not bypass it, do not remove it, and do not commit `GATE_PASSWORD` into source.
6. **The Sacred Flow (from the UI/UX prompts):** log on → pick an owner → type a task → hit enter → see it appear. Every UI change must preserve this. No new required fields, no modals before task submit, no extra clicks.
7. **Before pushing:** run `npm run lint && npx tsc --noEmit && npm run build`. CI will catch regressions anyway, but don't ship builds you haven't verified locally.
8. **Commit messages:** use multi-line format with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` on the last line.

---

## 9. Current work stream — UI/UX improvement prompts

User has a planned sequence of 13 prompts at `/Users/luishalvorssen/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/triptych-os-improvements/`. They send them one at a time.

| # | File | Status |
|---|---|---|
| 01 | `01-mobile-responsive-foundation.md` | ✅ shipped (commit `d2bfc82`) |
| 02 | `02-hover-and-touch-states.md` | ✅ shipped (commit `9b6a757`) |
| 03 | `03-typography-hierarchy.md` | ✅ shipped (commit `daa36d5`) |
| 04 | `04-card-contrast-and-spacing.md` | ✅ shipped (commit `e870fd2` + follow-up `eed28cb` making rows transparent on the card) |
| 05 | `05-context-tag-colors.md` | ✅ shipped (commit `cbcd157`) |
| 06 | `06-completion-animation.md` | ✅ shipped (commit `b2ab16e`) |
| 07 | `07-enter-to-submit-and-input-polish.md` | ✅ shipped (commit `092dbcc`) |
| 08 | `08-inline-edit-fix.md` | ⏳ next |
| 09 | `09-delete-undo-toast.md` | pending (the "completed → undo" toast was built in prompt 06; deletion still needs its own undo path) |
| 10 | `10-dark-mode-contrast.md` | pending |
| 11 | `11-keyboard-shortcuts.md` | pending |
| 12 | `12-command-palette.md` | pending |
| 13 | `13-header-and-avatar-polish.md` | pending |

## 9b. Top 3 Priorities (feature add — not from the prompt list)

Shipped in commit `5f31f69` between prompts 04 and 05. A team-wide ranked
billboard between the input bar and the task list. Always shows the same
three pinned tasks regardless of owner / context / All-vs-Mine filters.

- New `<TopPriorities>` component with a 2px Triptych-blue top accent on
  an otherwise standard `--card-bg` surface. Three numbered slots
  (`01 / 02 / 03`); empty slots render as dashed-border ghost rows so
  the structure is always visible and the feature is discoverable.
- Pin entry point: `☆ / ★` button in `<TaskRow>`'s actions group, paired
  with the existing delete (×). Hidden until row hover on desktop;
  always visible at 0.55 opacity on touch (mirrors the delete pattern).
  When all 3 slots are full, the pin button on non-pinned rows is
  disabled (`opacity: 0.35`, `cursor: default`); a toast.info("Top 3
  full") fallback fires if anything bypasses the disabled state.
- Pin behavior: fills lowest empty slot first (1 → 2 → 3). Newest pin
  shows in the section header as "UPDATED <relative-time> BY <user>".
- Reorder: HTML5 drag-and-drop within the billboard on desktop (no
  library — three items, contained scope). Empty slots are valid drop
  targets so a drag doubles as move-to-empty. On touch the reorder UX
  is `▲ / ▼` chevrons gated by `@media (hover: none)`.
- Auto-unpin on Done: handled by the `unpin_on_done()` Postgres trigger
  on `tasks` (see §5). Means the billboard stays focused on active work
  even when a pinned task is completed via swipe, undo toast, or a
  direct SQL update.
- Realtime sync via the `priorities-realtime` channel — pin / unpin /
  reorder events propagate to all four clients within ~50ms.
- All mutations flow through handlers in `app/page.tsx`:
  `handleTogglePin`, `handleReorderPriorities`. Optimistic with rollback
  on error, same pattern as task handlers.

**Pattern for handling a new prompt:**
1. Ask user to @-paste the prompt file
2. Read it, flag anything that conflicts with §8 rules, ask clarifying Qs
3. Split into a todo list, implement layer by layer
4. Run lint + typecheck + build locally before committing
5. Commit with subject `Prompt NN: <short summary>` + descriptive body + Claude co-author
6. Push → CI + Vercel auto-deploy → confirm green
7. Report back to user with screenshots + what changed

---

## 10. Known outstanding work (non-UX)

From the codebase audit done earlier, these P1/P2 items are not yet addressed:

- **RLS migration.** Move from the password-gate model to real Supabase Auth with per-user policies. Required if you ever want to remove the gate or expose the anon key publicly. Est. ~2 hr.
- **Rotate the Anthropic API key** (leaked in chat). https://console.anthropic.com/settings/keys → revoke + generate → update `.env.local` + `vercel env rm/add ANTHROPIC_API_KEY production` → redeploy.
- **Inline styles everywhere.** ~60% of each component is inline style objects. Works, but can't be dead-code-eliminated and can't reuse patterns. A later refactor could migrate to Tailwind classes or CSS Modules. Not urgent.
- **`STATUS_CONFIG` in `lib/constants.ts` is dead code** (used to be for the In Progress / Waiting On statuses before simplification). Can be deleted.
- **`@supabase/supabase-js` bundles auth + realtime even though we only use realtime + PostgREST.** Modest bundle-size win available if we ever need it.
- **Onboarding project (separate repo) is still down** since we migrated the `triptychmgmt.com` root domain away from the old `lhalvorssen` Vercel account. `onboarding.triptychmgmt.com` needs to be re-pointed or the project needs to move to the same `luishalvorssens-projects` team.

---

## 11. Common ops commands

Run from `/Users/luishalvorssen/Claude-Workspace/Projects/Triptych-OS/`.

```bash
# Dev
npm run dev              # http://localhost:3000 (or :3002 via launch.json)
npm run build            # production build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .

# Git / GitHub
git push origin main     # auto-deploys via Vercel GitHub integration
gh run list --repo LuisHalvorssen/Triptych-OS --limit 5    # recent CI runs
gh repo view LuisHalvorssen/Triptych-OS --web              # open in browser

# Vercel
npx vercel whoami                                  # confirm logged in as luishalvorssen
npx vercel ls triptych-os                          # recent deploys
npx vercel --prod --yes                            # manual prod deploy from local
npx vercel env ls production                       # inspect env var names (values encrypted)
npx vercel logs <deployment-url>                   # runtime logs
npx vercel inspect <deployment-url>                # metadata

# Supabase (ops, via REST with anon key)
# — read one task
curl -s "https://wpsprumpwklpwdgffgyr.supabase.co/rest/v1/tasks?select=*&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# DNS
dig +short tasks.triptychmgmt.com A    # should be 76.76.21.21

# Health check (copy-paste ready)
curl -sI https://tasks.triptychmgmt.com --max-time 10 | head -1
curl -s -X POST https://tasks.triptychmgmt.com/api/gate \
  -H "Content-Type: application/json" -d '{"password":"93Leonard"}' \
  -w "HTTP %{http_code}\n" -o /dev/null
```

---

## 12. Known quirks / gotchas

- **Mobile compact components override inline styles via CSS `!important`.** Inline style `display: "none"` or `width: 17` will beat a CSS rule without `!important`. If a mobile override isn't working, check for conflicting inline styles first.
- **The "Toast" and "ConfigMissing" components use the same visual aesthetic but live in different pipelines.** Toast is runtime-error surfacing; ConfigMissing is environment failure. Don't conflate them.
- **Next.js App Router's `metadata` is static by default.** For dynamic metadata, use the `generateMetadata` function. `viewport` export is separated from `metadata` in Next 15+.
- **`eslint-plugin-react-hooks` v7 flags `setState` in effects** that previously passed. The one intentional exception in the codebase is the cookie-hydration effect in `app/page.tsx`, which has a scoped `eslint-disable` block with an explanation.
- **`next lint` was removed in Next 16.** We use `eslint .` directly via flat config. Don't try to "fix" the lint script back to `next lint`.
- **Preview MCP screenshots can lag behind HMR.** If the browser shows stale state but `fetch('/')` returns correct content, force a hard reload (`location.replace(url)`) before screenshotting.
- **The `.claude/` folder is gitignored** (after an earlier cleanup). Don't re-add `.claude/launch.json` — it's personal dev config.

---

## 13. Recent history (most recent first)

Commit log so a future Claude can quickly see what shipped:

```
092dbcc  Prompt 07: Form submission, focus accent, and input polish
b2ab16e  Prompt 06: Task completion animation + undo toast
cbcd157  Prompt 05: Color system for context tags
5f31f69  Add Top 3 priorities billboard
cb91e89  Update SESSION-CONTEXT for Prompts 02-04 shipped
eed28cb  Fix: rows transparent on card surface
e870fd2  Prompt 04: Card elevation, dividers, and row spacing
daa36d5  Prompt 03: Typography hierarchy in task list
9b6a757  Prompt 02: Hover (desktop) and touch (mobile) states for task rows
6580029  Add docs/SESSION-CONTEXT.md — handoff for future Claude sessions
d2bfc82  Prompt 01: Responsive foundation — mobile-first layout
343b904  P1: ConfigMissing screen + toast error surfacing with rollback
88ba7a6  P1 quick wins: README, CI workflow, ungit .claude, ESLint 9 migration
cdac731  Upgrade Next.js 14.2.15 → 16.2.4 + ESLint 9
f7ba687  Add shared-password gate via Edge Middleware
fe654ce  Initial commit: Triptych OS
```

### CSS tokens added by the UX pass

These are referenced throughout `app/globals.css` and inline styles in
`TaskRow.tsx` / `TaskList.tsx` / `TopPriorities.tsx`. Both themes define
them.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--task-title` | `#1A1A2E` | `#E8E8E8` | Task title text (Prompt 03) |
| `--task-date` | `#999999` | `#777777` | Date metadata text (Prompt 03) |
| `--card-bg` | `#FFFFFF` | `#111139` | Task list + billboard card surface (Prompt 04) |
| `--row-divider` | `#EAEAEA` | `rgba(255,255,255,0.08)` | Row borders, tabs underline, header bottom (Prompt 04) |
| `--card-shadow` | layered rgba | `0 1px 3px rgba(0,0,0,0.3)` | Card elevation desktop (Prompt 04) |
| `--card-shadow-mobile` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | Card elevation mobile (Prompt 04) |
| `--swipe-complete` | `#22C55E` | `#22C55E` | Swipe-right completion bg with white checkmark (Prompt 06) |

### Tag color system (Prompt 05)

`tagStyle()` in `lib/constants.ts` returns `{ color, bg }` based on the
current `data-theme` attribute. Eleven hand-tuned light/dark pairs in
the `TAG_COLORS` map cover MGMT (blues), Digital (orange), Internal
(greens/teals + amber Fundraising). `tagShortName()` provides the
mobile-friendly labels ("Internal: BD" → "BD"). Render as paired
`<span class="tag-full">` / `<span class="tag-short">` and let CSS
`@media (max-width: 639px)` swap visibility.

### Animation conventions

- Hover/active feedback for rows lives in `globals.css` under
  `@media (hover: hover)` and `@media (hover: none)` blocks (Prompt 02).
  Do not move it back into React state — CSS owns it.
- Task rows use `background: transparent` so they inherit the card
  surface; the hover overlay paints rgba on top.
- Task completion animation (Prompt 06) is a 600ms three-stage CSS
  sequence triggered by adding the `.completing` class to
  `.task-row-swipe`. The state-flip-to-Done is deferred via setTimeout
  so the animation runs to completion. Also see `tp-checkbox-pop`,
  `tp-strike`, `tp-fadein` keyframes.
- New-row enter animation (Prompt 07) is `tp-row-in` applied via
  `.task-row-new`, gated by a module-level `PAGE_MOUNT_TIME` so only
  tasks created in this session animate — history rows render statically.
- Undo toast = `toast.action(message, { label, onClick })` — distinct
  dark-pill variant in `Toaster.tsx`. Bottom-anchored with safe-area
  awareness on mobile.

---

**If this doc gets out of date, ask the active Claude to update it. The file is meant to travel with the repo and evolve with the work.**
