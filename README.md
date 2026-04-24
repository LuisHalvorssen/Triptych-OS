# Triptych OS

Internal task tracker for [Triptych Management](https://triptychmgmt.com) — a 4-person music/media company in NYC.
Live at **[tasks.triptychmgmt.com](https://tasks.triptychmgmt.com)** (password-gated).

## Stack

- **Next.js 16** (App Router) + TypeScript (strict) + Tailwind
- **Supabase** — `tasks` table + Realtime for cross-client sync
- **Anthropic** — Claude Haiku 4.5 auto-categorizes tasks into one of 11 context tags (~$0.0007/task)
- **Vercel** — hosted at `luishalvorssens-projects/triptych-os`, auto-deploys on push to `main`

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev                   # → http://localhost:3000
```

### Env vars

| Name                              | Where it's used           | Notes                                              |
| --------------------------------- | ------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Browser + server          | Supabase project URL                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Browser + server          | Supabase anon JWT                                  |
| `ANTHROPIC_API_KEY`               | Server only (`/api/categorize`) | Never shipped to the browser                |
| `GATE_PASSWORD`                   | Server only (middleware)  | Shared password for the team; never shipped to browser |

Set all four in the Vercel project for production: `Settings → Environment Variables`.

## Architecture

```
app/
  page.tsx                  single-page app — owns task state, mutation handlers
  gate/page.tsx             password prompt
  api/categorize/route.ts   server-side Anthropic proxy (Haiku 4.5, max_tokens 60)
  api/gate/route.ts         password check → sets HttpOnly cookie
  layout.tsx                fonts (Syne + IBM Plex Mono) via next/font
  globals.css               CSS variables for dark + light themes
middleware.ts               gates every route behind GATE_PASSWORD cookie
components/
  Header                    team avatars + theme toggle + user switch
  TaskInput                 owner dropdown + text input + ADD button
  TaskList                  filters (owner/context/tab) + empty state
  TaskRow                   inline-edit title/owner/context, toggle done, delete
  UserSelector              first-load "who are you?" screen
lib/
  constants.ts              TEAM, TAGS, OWNER_COLORS, STATUS_CONFIG
  types.ts                  Task, Status, ContextTag, TeamMember
  supabase.ts               client singleton
  cookies.ts                triptych-user cookie helpers
  theme.ts                  triptych-theme cookie + data-theme attribute
  gate.ts                   SHA-256 gate token (used by middleware + /api/gate)
```

## Key rules

- **No `any` types.** TypeScript strict mode.
- **Mutations flow through `app/page.tsx`** — components call props, never `supabase.*` directly, so local state and DB stay in sync.
- **Tag list is authoritative in 3 places** — `lib/types.ts` (`ContextTag`), `lib/constants.ts` (`TAGS`), and the prompt in `app/api/categorize/route.ts`. All three must stay in sync.
- **Env vars with `NEXT_PUBLIC_` prefix ship to the browser.** Anything secret (Anthropic key, gate password) must not use that prefix.

## Scripts

```bash
npm run dev         # Next dev server
npm run build       # Production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

## Ops

- **Supabase project:** `wpsprumpwklpwdgffgyr.supabase.co` (Realtime enabled on `tasks`)
- **Vercel project:** `luishalvorssens-projects/triptych-os`
- **Deploy:** `git push origin main` → auto-deploys within ~60s
- **Manual deploy:** `npx vercel --prod`
- **Logs:** `npx vercel logs <deployment-url>`

## Security notes

- Site is gated by a shared password (`GATE_PASSWORD` env var) via Edge Middleware. Cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, 30-day TTL.
- Supabase `tasks` table currently has permissive RLS (any anon-key request can read/write). The gate is the only thing stopping a random visitor from manipulating data. If the user list grows or the tool handles sensitive data, migrate to Supabase Auth with per-user policies.
- Anthropic key is server-only (`/api/categorize`). Never sent to browser.
