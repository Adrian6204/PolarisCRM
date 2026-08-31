import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { toSkipTake } from "@/lib/validation";
import type { ListResult } from "@/features/clients/service";
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
  project: { select: { id: true, name: true } },
} as const;

export type DeliverableWithOwner = Prisma.DeliverableGetPayload<{
  include: {
    owner: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
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
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await assertProjectActive(db, projectId);
  await assertOwnerExists(db, input.ownerId);

  const deliverable = await db.deliverable.create({
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
  opts.log?.debug({ deliverableId: deliverable.id, projectId }, "db write: deliverable created");
  return deliverable;
}

export async function updateDeliverable(
  id: string,
  input: UpdateDeliverableInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const existing = await db.deliverable.findFirst({
    where: { id, ...notDeleted },
    select: { id: true },
  });
  if (!existing) throw ApiError.notFound("Deliverable not found");
  if (input.ownerId !== undefined) await assertOwnerExists(db, input.ownerId);

  const deliverable = await db.deliverable.update({
    where: { id },
    data: input,
    include: relations,
  });
  opts.log?.debug({ deliverableId: id }, "db write: deliverable updated");
  return deliverable;
}

export async function softDeleteDeliverable(
  id: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const result = await db.deliverable.updateMany({
    where: { id, ...notDeleted },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound("Deliverable not found");
  opts.log?.debug({ deliverableId: id }, "db write: deliverable soft-deleted");
}
