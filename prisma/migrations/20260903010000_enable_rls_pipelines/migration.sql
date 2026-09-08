-- Enable Row Level Security on the pipeline tables, consistent with the other
-- app tables. Prisma connects as the owner role and bypasses RLS; this closes
-- off Supabase's public REST API.
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
