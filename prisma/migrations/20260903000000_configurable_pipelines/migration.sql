-- Configurable pipelines (G2): replace the fixed DealStage enum with named
-- pipelines + ordered, kinded stages. Existing deals are migrated onto a seeded
-- "Sales" default pipeline whose stages mirror the old enum.

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('open', 'won', 'lost');

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StageKind" NOT NULL DEFAULT 'open',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_archived_sort_order_idx" ON "pipelines"("archived", "sort_order");
CREATE INDEX "pipeline_stages_pipeline_id_sort_order_idx" ON "pipeline_stages"("pipeline_id", "sort_order");

-- Seed the default pipeline + stages mirroring the old enum.
INSERT INTO "pipelines" ("id", "name", "sort_order", "archived", "is_default")
VALUES ('pl_default', 'Sales', 0, false, true);

INSERT INTO "pipeline_stages" ("id", "pipeline_id", "name", "kind", "sort_order") VALUES
  ('st_lead',     'pl_default', 'Lead',     'open', 0),
  ('st_proposal', 'pl_default', 'Proposal', 'open', 1),
  ('st_won',      'pl_default', 'Won',      'won',  2),
  ('st_lost',     'pl_default', 'Lost',     'lost', 3);

-- Add the new FK columns (nullable during backfill).
ALTER TABLE "deals" ADD COLUMN "pipeline_id" TEXT;
ALTER TABLE "deals" ADD COLUMN "stage_id" TEXT;

-- Backfill: every existing deal joins the default pipeline; stage maps 1:1.
UPDATE "deals" SET "pipeline_id" = 'pl_default', "stage_id" = 'st_' || "stage"::text;

-- Enforce NOT NULL now that every row is populated.
ALTER TABLE "deals" ALTER COLUMN "pipeline_id" SET NOT NULL;
ALTER TABLE "deals" ALTER COLUMN "stage_id" SET NOT NULL;

-- Drop the old enum column + its index, then the enum type.
DROP INDEX IF EXISTS "deals_stage_idx";
ALTER TABLE "deals" DROP COLUMN "stage";
DROP TYPE "DealStage";

-- New FK indexes.
CREATE INDEX "deals_pipeline_id_idx" ON "deals"("pipeline_id");
CREATE INDEX "deals_stage_id_idx" ON "deals"("stage_id");

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
