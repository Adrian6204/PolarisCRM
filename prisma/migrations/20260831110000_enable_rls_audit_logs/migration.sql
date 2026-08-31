-- Enable Row Level Security on audit_logs, consistent with the other app tables
-- (see 20260831010000_enable_rls). Prisma connects as the owner role and
-- bypasses RLS; this closes off Supabase's public REST API.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
