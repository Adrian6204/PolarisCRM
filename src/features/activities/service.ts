import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { toSkipTake } from "@/lib/validation";
import type { ListResult } from "@/features/clients/service";
import type { CreateActivityInput, ListActivitiesQuery } from "./schema";

/**
 * Activity (interaction log) business logic. Append-only — create, list, and
 * (writer-only) delete; no update. The feed is per-client, newest first.
 *
 * Activities aren't soft-deleted (SPEC scopes soft delete to
 * Client/Project/Deliverable), but the parent client must be active to log or
 * read, so a soft-deleted client's history stays hidden with the client.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const relations = {
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
} as const;

export type ActivityWithRefs = Prisma.ActivityGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
  };
}>;

async function assertClientActive(db: Db, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw ApiError.notFound("Client not found");
}

/** If a project is referenced, it must belong to this client and be active. */
async function assertProjectForClient(db: Db, clientId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, clientId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.badRequest("project does not belong to this client");
}

export async function listActivities(
  clientId: string,
  query: ListActivitiesQuery,
  opts: { db?: Db } = {},
): Promise<ListResult<ActivityWithRefs>> {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  const where: Prisma.ActivityWhereInput = {
    clientId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.projectId ? { projectId: query.projectId } : {}),
  };
  const [total, items] = await Promise.all([
    db.activity.count({ where }),
    db.activity.findMany({
      where,
      include: relations,
      orderBy: { createdAt: "desc" }, // chronological feed, newest first
      ...toSkipTake({ page: query.page, pageSize: query.pageSize }),
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function createActivity(
  clientId: string,
  input: CreateActivityInput,
  createdById: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  if (input.projectId) await assertProjectForClient(db, clientId, input.projectId);

  const activity = await db.activity.create({
    data: {
      clientId,
      projectId: input.projectId ?? null,
      type: input.type,
      summary: input.summary,
      createdById,
    },
    include: relations,
  });
  opts.log?.debug({ activityId: activity.id, clientId }, "db write: activity logged");
  return activity;
}

/** Hard delete (no soft delete for activities). Writer-only at the route. */
export async function deleteActivity(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const result = await db.activity.deleteMany({ where: { id } });
  if (result.count === 0) throw ApiError.notFound("Activity not found");
  opts.log?.debug({ activityId: id }, "db write: activity deleted");
}
