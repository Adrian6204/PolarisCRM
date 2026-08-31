import type { Prisma, PrismaClient } from "@prisma/client";
import { EngagementType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { toSkipTake } from "@/lib/validation";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { defaultStage, isValidStage } from "./stages";
import { invalidateServiceLineStats } from "@/features/reports/service";
import { auditData } from "@/features/audit/service";
import { cacheInvalidate, cacheKeys } from "@/lib/cache";
import { runInTx } from "@/lib/tx";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "./schema";
import type { ListResult, WriteOpts } from "@/features/clients/service";

/**
 * Project business logic. Soft-delete-aware like the client service; also owns
 * the stage rules that can't live in Zod alone (updates need the project's
 * existing service/engagement type to validate a stage transition).
 */
type Db = PrismaClient | Prisma.TransactionClient;

const notDeleted = { deletedAt: null } satisfies Prisma.ProjectWhereInput;

export type ProjectRecord = Prisma.ProjectGetPayload<object>;
export type ProjectWithClient = Prisma.ProjectGetPayload<{
  include: { client: true };
}>;

async function assertClientActive(db: Db, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw ApiError.notFound("Client not found");
}

export async function listProjects(
  query: ListProjectsQuery,
  opts: { db?: Db; withClient?: boolean } = {},
): Promise<ListResult<ProjectRecord>> {
  const db = opts.db ?? defaultPrisma;
  const where: Prisma.ProjectWhereInput = {
    ...notDeleted,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.engagementType ? { engagementType: query.engagementType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
  };

  const [total, items] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: opts.withClient ? { client: true } : undefined,
      ...toSkipTake({ page: query.page, pageSize: query.pageSize }),
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export function getProject(
  id: string,
  opts: { db?: Db; withClient: true },
): Promise<ProjectWithClient>;
export function getProject(
  id: string,
  opts?: { db?: Db; withClient?: false },
): Promise<ProjectRecord>;
export async function getProject(
  id: string,
  opts: { db?: Db; withClient?: boolean } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const project = await db.project.findFirst({
    where: { id, ...notDeleted },
    include: opts.withClient ? { client: true } : undefined,
  });
  if (!project) throw ApiError.notFound("Project not found");
  return project;
}

export async function createProject(
  clientId: string,
  input: CreateProjectInput,
  opts: WriteOpts = {},
) {
  // Default the stage to the first in the service/engagement's set when unset.
  const stage =
    input.stage ?? defaultStage(input.serviceType, input.engagementType);

  const project = await runInTx(opts.db, async (tx) => {
    await assertClientActive(tx, clientId);
    const created = await tx.project.create({
      data: {
        clientId,
        name: input.name,
        serviceType: input.serviceType,
        engagementType: input.engagementType,
        stage,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        retainerRenewalDate: input.retainerRenewalDate ?? null,
        status: input.status,
      },
    });
    if (opts.actorId) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.project,
          entityId: created.id,
          action: AuditAction.create,
          clientId,
          actorId: opts.actorId,
          after: created,
        }),
      });
    }
    return created;
  });
  opts.log?.debug({ projectId: project.id, clientId }, "db write: project created");
  // Post-commit: a new active project changes the per-service-line counts.
  await invalidateServiceLineStats();
  return project;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  opts: WriteOpts = {},
) {
  const project = await runInTx(opts.db, async (tx) => {
    const existing = await tx.project.findFirst({ where: { id, ...notDeleted } });
    if (!existing) throw ApiError.notFound("Project not found");

    // Stage transitions are validated against the project's (immutable)
    // service/engagement type.
    if (input.stage && !isValidStage(existing.serviceType, existing.engagementType, input.stage)) {
      throw ApiError.badRequest(
        `Invalid stage "${input.stage}" for ${existing.serviceType}/${existing.engagementType}`,
      );
    }
    if (existing.engagementType === EngagementType.one_off && input.retainerRenewalDate) {
      throw ApiError.badRequest("retainerRenewalDate is only valid for retainer engagements");
    }
    const start = input.startDate ?? existing.startDate;
    const end = input.endDate === undefined ? existing.endDate : input.endDate;
    if (end && end < start) {
      throw ApiError.badRequest("endDate cannot be before startDate");
    }

    const updated = await tx.project.update({ where: { id }, data: input });
    if (opts.actorId) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.project,
          entityId: id,
          action: AuditAction.update,
          clientId: existing.clientId,
          actorId: opts.actorId,
          before: existing,
          after: updated,
        }),
      });
    }
    return updated;
  });
  opts.log?.debug({ projectId: id }, "db write: project updated");
  // Post-commit: status changes move counts through the active bucket.
  await invalidateServiceLineStats();
  return project;
}

export async function softDeleteProject(id: string, opts: WriteOpts = {}) {
  const before = await runInTx(opts.db, async (tx) => {
    // Fetched inside the tx — needed for the audit diff and cache invalidation.
    const existing = await tx.project.findFirst({ where: { id, ...notDeleted } });
    const result = await tx.project.updateMany({
      where: { id, ...notDeleted },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw ApiError.notFound("Project not found");
    if (opts.actorId && existing) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.project,
          entityId: id,
          action: AuditAction.delete,
          clientId: existing.clientId,
          actorId: opts.actorId,
          before: existing,
        }),
      });
    }
    return existing;
  });
  opts.log?.debug({ projectId: id }, "db write: project soft-deleted");
  // Post-commit cache invalidation.
  await invalidateServiceLineStats();
  // A soft-deleted project drops out of listClientReports (filters deletedAt),
  // so its client's cached report set must be invalidated.
  if (before) await cacheInvalidate(cacheKeys.clientReports(before.clientId));
}
