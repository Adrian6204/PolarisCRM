-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('lead', 'proposal', 'won', 'lost');

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "stage" "DealStage" NOT NULL DEFAULT 'lead',
    "owner_id" TEXT,
    "notes" TEXT,
    "expected_close_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deals_client_id_idx" ON "deals"("client_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE INDEX "deals_owner_id_idx" ON "deals"("owner_id");

-- CreateIndex
CREATE INDEX "deals_deleted_at_idx" ON "deals"("deleted_at");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
