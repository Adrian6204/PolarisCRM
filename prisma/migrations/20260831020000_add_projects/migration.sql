-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('web_dev', 'seo', 'software_dev', 'app_dev', 'aigc');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('one_off', 'retainer');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "stage" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "retainer_renewal_date" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_service_type_idx" ON "projects"("service_type");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "projects_retainer_renewal_date_idx" ON "projects"("retainer_renewal_date");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
