-- File attachments (P9): metadata for files stored in Supabase Storage.
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachments_client_id_created_at_idx" ON "attachments"("client_id", "created_at");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS on, consistent with the other app tables (Prisma owner role bypasses).
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
