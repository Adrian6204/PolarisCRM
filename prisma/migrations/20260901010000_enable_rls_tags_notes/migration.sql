-- Enable Row Level Security on tags/client_tags/notes, consistent with the
-- other app tables. Prisma connects as the owner role and bypasses RLS; this
-- closes off Supabase's public REST API.
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
