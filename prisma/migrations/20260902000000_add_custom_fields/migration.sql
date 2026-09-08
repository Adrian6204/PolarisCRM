-- Custom field definitions + per-client values (G1b).

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'textarea', 'number', 'date', 'boolean', 'url', 'select');

-- CreateTable
CREATE TABLE "custom_field_defs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'text',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_custom_fields" (
    "client_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "client_custom_fields_pkey" PRIMARY KEY ("client_id","field_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_defs_key_key" ON "custom_field_defs"("key");

-- CreateIndex
CREATE INDEX "custom_field_defs_archived_sort_order_idx" ON "custom_field_defs"("archived", "sort_order");

-- CreateIndex
CREATE INDEX "client_custom_fields_field_id_idx" ON "client_custom_fields"("field_id");

-- AddForeignKey
ALTER TABLE "client_custom_fields" ADD CONSTRAINT "client_custom_fields_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_custom_fields" ADD CONSTRAINT "client_custom_fields_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
