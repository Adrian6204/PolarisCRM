-- Enable Row Level Security on the calendar tables, consistent with the other
-- app tables. Prisma connects as the owner role and bypasses RLS; this closes
-- off Supabase's public REST API.
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_rules" ENABLE ROW LEVEL SECURITY;
