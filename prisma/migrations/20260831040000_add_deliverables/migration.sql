-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('not_started', 'in_progress', 'review', 'done');

-- CreateTable
CREATE TABLE "deliverables" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "DeliverableStatus" NOT NULL DEFAULT 'not_started',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliverables_project_id_idx" ON "deliverables"("project_id");

-- CreateIndex
CREATE INDEX "deliverables_owner_id_idx" ON "deliverables"("owner_id");

-- CreateIndex
CREATE INDEX "deliverables_status_idx" ON "deliverables"("status");

-- CreateIndex
CREATE INDEX "deliverables_due_date_idx" ON "deliverables"("due_date");

-- CreateIndex
CREATE INDEX "deliverables_deleted_at_idx" ON "deliverables"("deleted_at");

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
