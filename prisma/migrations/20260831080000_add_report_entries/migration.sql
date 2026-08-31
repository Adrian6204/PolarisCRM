-- CreateTable
CREATE TABLE "report_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_entries_project_id_idx" ON "report_entries"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_entries_project_id_period_key" ON "report_entries"("project_id", "period");

-- AddForeignKey
ALTER TABLE "report_entries" ADD CONSTRAINT "report_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
