-- Enable Row Level Security on the custom-field tables, consistent with the
-- other app tables. Prisma connects as the owner role and bypasses RLS; this
-- closes off Supabase's public REST API.
ALTER TABLE "custom_field_defs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_custom_fields" ENABLE ROW LEVEL SECURITY;
