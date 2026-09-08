-- Enable Row Level Security on the automation tables, consistent with the other
-- app tables. Prisma connects as the owner role and bypasses RLS; this closes
-- off Supabase's public REST API.
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;
