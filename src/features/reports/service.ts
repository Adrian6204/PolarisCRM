import type { Prisma, PrismaClient, ServiceType } from "@prisma/client";
import { ProjectStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { cacheGetOrSet, cacheInvalidate, cacheKeys } from "@/lib/cache";
import type { UpsertReportInput } from "./schema";

/**
 * Reporting service (Phase 6). Owns ReportEntry writes and the read-heavy,
 * cache-worthy views: a client's report set and the dashboard's active-
 * engagements-per-service-line rollup. Both are read-through cached with
 * explicit invalidation on the writes that affect them.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const CLIENT_REPORTS_TTL = 300; // 5 min — reports change rarely
const SERVICE_LINES_TTL = 120; // 2 min — a safety net behind explicit invalidation

export type ReportRecord = Prisma.ReportEntryGetPayload<{
  include: { project: { select: { id: true; name: true; serviceType: true; clientId: true } } };
}>;

const projectSelect = {
  project: { select: { id: true, name: true, serviceType: true, clientId: true } },
} as const;

/** Look up a project's client id, guarding that the project is active. */
async function projectClientId(db: Db, projectId: string): Promise<string> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { clientId: true },
  });
  if (!project) throw ApiError.notFound("Project not found");
  return project.clientId;
}

/** Create or update the report for a project + period (unique together). */
export async function upsertReport(
  projectId: string,
  input: UpsertReportInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const clientId = await projectClientId(db, projectId);

  const report = await db.reportEntry.upsert({
    where: { projectId_period: { projectId, period: input.period } },
    create: {
      projectId,
      period: input.period,
      metrics: input.metrics,
      notes: input.notes ?? null,
    },
    update: { metrics: input.metrics, notes: input.notes ?? null },
    include: projectSelect,
  });
  opts.log?.debug({ reportId: report.id, projectId, period: input.period }, "db write: report upserted");
  // Invalidate the client's cached report set.
  await cacheInvalidate(cacheKeys.clientReports(clientId));
  return report;
}

export async function deleteReport(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const report = await db.reportEntry.findUnique({
    where: { id },
    select: { id: true, project: { select: { clientId: true } } },
  });
  if (!report) throw ApiError.notFound("Report not found");
  await db.reportEntry.delete({ where: { id } });
  opts.log?.debug({ reportId: id }, "db write: report deleted");
  await cacheInvalidate(cacheKeys.clientReports(report.project.clientId));
}

/** All reports for a client's active projects, newest period first. Cached. */
export async function listClientReports(
  clientId: string,
  opts: { db?: Db } = {},
): Promise<ReportRecord[]> {
  const db = opts.db ?? defaultPrisma;
  return cacheGetOrSet(cacheKeys.clientReports(clientId), CLIENT_REPORTS_TTL, () =>
    db.reportEntry.findMany({
      where: { project: { clientId, deletedAt: null } },
      include: projectSelect,
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    }),
  );
}

export interface ServiceLineStat {
  serviceType: ServiceType;
  active: number;
}

/**
 * Active (non-deleted, status=active) engagement count per service line. This
 * is the dashboard's read-heavy rollup — cached, and invalidated on any project
 * write via invalidateServiceLineStats().
 */
export async function getServiceLineStats(
  opts: { db?: Db } = {},
): Promise<ServiceLineStat[]> {
  const db = opts.db ?? defaultPrisma;
  return cacheGetOrSet(cacheKeys.dashboardServiceLines, SERVICE_LINES_TTL, async () => {
    const grouped = await db.project.groupBy({
      by: ["serviceType"],
      where: { deletedAt: null, status: ProjectStatus.active },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ serviceType: g.serviceType, active: g._count._all }));
  });
}

/** Invalidate the service-line rollup — called from project writes. */
export async function invalidateServiceLineStats() {
  await cacheInvalidate(cacheKeys.dashboardServiceLines);
}
