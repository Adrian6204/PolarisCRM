-- Enable Row Level Security on all app tables.
--
-- This app accesses Postgres exclusively through Prisma, connecting as the
-- table-owner `postgres` role, which BYPASSES RLS (no FORCE set). Enabling RLS
-- with no policies therefore does NOT affect the app, but it locks down
-- Supabase's auto-generated REST API (anon/authenticated roles) so the anon key
-- can no longer read/write these tables — notably users.password_hash.
--
-- If a feature ever needs Supabase client-library (PostgREST) access, add
-- explicit policies then.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
