import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { toSkipTake } from "@/lib/validation";
import { runInTx } from "@/lib/tx";
import { auditData } from "@/features/audit/service";
import type { ListResult, WriteOpts } from "@/features/clients/service";
import type {
  CreateDeliverableInput,
  ListDeliverablesQuery,
  UpdateDeliverableInput,
} from "./schema";

/**
 * Deliverable (task) business logic. Soft-delete-aware. Owner assignments are
 * validated to be real users. The owner relation is included on reads so the
 * board can show who's responsible without an extra query.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const notDeleted = { deletedAt: null } satisfies Prisma.DeliverableWhereInput;

// Relations the board/list views need. Owner select never exposes password_hash;
// project select is light (the global task view shows which project a task is in).
const relations = {
  owner: { select: { id: true, name: true, email: true } },
  // clientId is needed to denormalize onto audit rows; UI consumers ignore it.
  project: { select: { id: true, name: true, clientId: true } },
} as const;

export type DeliverableWithOwner = Prisma.DeliverableGetPayload<{
  include: {
    owner: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true; clientId: true } };
  };
}>;

async function assertProjectActive(db: Db, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.notFound("Project not found");
}

/** Verify an owner id refers to a real user (owner is optional overall). */
async function assertOwnerExists(db: Db, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const user = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!user) throw ApiError.badRequest("owner is not a valid user");
}

export async function listDeliverables(
  query: ListDeliverablesQuery,
  opts: { db?: Db } = {},
): Promise<ListResult<DeliverableWithOwner>> {
  const db = opts.db ?? defaultPrisma;
  const where: Prisma.DeliverableWhereInput = {
    ...notDeleted,
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [total, items] = await Promise.all([
    db.deliverable.count({ where }),
    db.deliverable.findMany({
      where,
      include: relations,
      // Due soonest first (nulls last), then newest.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      ...toSkipTake({ page: query.page, pageSize: query.pageSize }),
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getDeliverable(id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const deliverable = await db.deliverable.findFirst({
    where: { id, ...notDeleted },
    include: relations,
  });
  if (!deliverable) throw ApiError.notFound("Deliverable not found");
  return deliverable;
}

export async function createDeliverable(
  projectId: string,
  input: CreateDeliverableInput,
  opts: WriteOpts = {},
) {
  const deliverable = await runInTx(opts.db, async (tx) => {
    await assertProjectActive(tx, projectId);
    await assertOwnerExists(tx, input.ownerId);
    const created = await tx.deliverable.create({
      data: {
        projectId,
        title: input.title,
        description: input.description ?? null,
        ownerId: input.ownerId ?? null,
        dueDate: input.dueDate ?? null,
        status: input.status,
      },
      include: relations,
    });
    if (opts.actorId) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.deliverable,
          entityId: created.id,
          action: AuditAction.create,
          clientId: created.project.clientId,
          actorId: opts.actorId,
          after: created,
        }),
      });
    }
    return created;
  });
  opts.log?.debug({ deliverableId: deliverable.id, projectId }, "db write: deliverable created");
  return deliverable;
}

export async function updateDeliverable(
  id: string,
  input: UpdateDeliverableInput,
  opts: WriteOpts = {},
) {
  const deliverable = await runInTx(opts.db, async (tx) => {
    const existing = await tx.deliverable.findFirst({
      where: { id, ...notDeleted },
      include: { project: { select: { clientId: true } } },
    });
    if (!existing) throw ApiError.notFound("Deliverable not found");
    if (input.ownerId !== undefined) await assertOwnerExists(tx, input.ownerId);

    const updated = await tx.deliverable.update({ where: { id }, data: input, include: relations });
    if (opts.actorId) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.deliverable,
          entityId: id,
          action: AuditAction.update,
          clientId: existing.project.clientId,
          actorId: opts.actorId,
          before: existing,
          after: updated,
        }),
      });
    }
    return updated;
  });
  opts.log?.debug({ deliverableId: id }, "db write: deliverable updated");
  return deliverable;
}

export async function softDeleteDeliverable(id: string, opts: WriteOpts = {}) {
  await runInTx(opts.db, async (tx) => {
    const before = opts.actorId
      ? await tx.deliverable.findFirst({
          where: { id, ...notDeleted },
          include: { project: { select: { clientId: true } } },
        })
      : null;
    const result = await tx.deliverable.updateMany({
      where: { id, ...notDeleted },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw ApiError.notFound("Deliverable not found");
    if (opts.actorId && before) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.deliverable,
          entityId: id,
          action: AuditAction.delete,
          clientId: before.project.clientId,
          actorId: opts.actorId,
          before,
        }),
      });
    }
  });
  opts.log?.debug({ deliverableId: id }, "db write: deliverable soft-deleted");
}
