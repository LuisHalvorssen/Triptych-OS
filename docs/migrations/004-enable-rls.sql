-- Migration 004: Lock down all tables with RLS deny-all.
--
-- After this runs, the public anon role can do nothing. The service_role
-- key (used only server-side from /api/* routes) bypasses RLS by design,
-- so the app continues to work unchanged.
--
-- Pair this with: removing NEXT_PUBLIC_SUPABASE_ANON_KEY from the browser
-- bundle (the lib/supabase.ts client was deleted) and adding
-- SUPABASE_SERVICE_ROLE_KEY as a server-only env var on Vercel.
--
-- Resolves the Supabase "Table publicly accessible" warning by genuinely
-- closing the gap, not just creating a permissive policy that pretends to.

alter table public.tasks            enable row level security;
alter table public.top_priorities   enable row level security;
alter table public.digital_clients  enable row level security;

-- Explicitly: no policies for anon = no access. (RLS-enabled tables
-- without matching policies deny everything by default.) We add no
-- anon policies on purpose.

-- Optional belt-and-suspenders: REVOKE direct grants from anon. Default
-- Supabase grants the anon role broad access via the role's GRANTs
-- (separate from RLS). RLS now blocks anon, but if RLS were ever
-- accidentally disabled this would still keep the anon role out.

revoke all on public.tasks            from anon;
revoke all on public.top_priorities   from anon;
revoke all on public.digital_clients  from anon;

-- Keep service_role's grants intact (they're the default; just being
-- explicit). All API-route writes use this role.
grant all on public.tasks            to service_role;
grant all on public.top_priorities   to service_role;
grant all on public.digital_clients  to service_role;
