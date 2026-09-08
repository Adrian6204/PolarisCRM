import type { Prisma, PrismaClient } from "@prisma/client";
import { ClientStatus, StageKind } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { toSkipTake } from "@/lib/validation";
import type { ListResult } from "@/features/clients/service";
import type { CreateDealInput, ListDealsQuery, UpdateDealInput } from "./schema";

/**
 * Deal / sales-pipeline business logic. Deals live on a pipeline stage; the
 * stage's `kind` carries terminal semantics — reaching a `won`/`lost` stage
 * stamps closedAt, and winning promotes a still-prospect client to active (the
 * pre-contract → contract transition the SPEC calls out). Soft-delete-aware.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const notDeleted = { deletedAt: null } satisfies Prisma.DealWhereInput;

const relations = {
  owner: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, status: true } },
  stage: { select: { id: true, name: true, kind: true, pipelineId: true, sortOrder: true } },
  pipeline: { select: { id: true, name: true } },
} as const;

export type DealWithRefs = Prisma.DealGetPayload<{ include: typeof relations }>;

async function assertClientActive(db: Db, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw ApiError.notFound("Client not found");
}

async function assertOwnerExists(db: Db, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const user = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!user) throw ApiError.badRequest("owner is not a valid user");
}

/** Resolve a stage, ensuring it belongs to the given pipeline. Returns kind. */
async function resolveStage(db: Db, pipelineId: string, stageId: string) {
  const stage = await db.pipelineStage.findUnique({
    where: { id: stageId },
    select: { id: true, pipelineId: true, kind: true },
  });
  if (!stage || stage.pipelineId !== pipelineId) {
    throw ApiError.badRequest("stage does not belong to the pipeline");
  }
  return stage;
}

const isTerminal = (kind: StageKind) => kind === StageKind.won || kind === StageKind.lost;

export async function listDeals(
  query: ListDealsQuery,
  opts: { db?: Db } = {},
): Promise<ListResult<DealWithRefs>> {
  const db = opts.db ?? defaultPrisma;
  const where: Prisma.DealWhereInput = {
    ...notDeleted,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const [total, items] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      include: relations,
      orderBy: { createdAt: "desc" },
      ...toSkipTake({ page: query.page, pageSize: query.pageSize }),
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getDeal(id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const deal = await db.deal.findFirst({ where: { id, ...notDeleted }, include: relations });
  if (!deal) throw ApiError.notFound("Deal not found");
  return deal;
}

export async function createDeal(
  clientId: string,
  input: CreateDealInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  await assertOwnerExists(db, input.ownerId);
  const stage = await resolveStage(db, input.pipelineId, input.stageId);

  const deal = await db.deal.create({
    data: {
      clientId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      title: input.title,
      value: input.value,
      ownerId: input.ownerId ?? null,
      notes: input.notes ?? null,
      expectedCloseDate: input.expectedCloseDate ?? null,
      closedAt: isTerminal(stage.kind) ? new Date() : null,
    },
    include: relations,
  });
  opts.log?.debug({ dealId: deal.id, clientId }, "db write: deal created");
  if (stage.kind === StageKind.won) await promoteClientOnWin(db, clientId, opts.log);
  return deal;
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const existing = await db.deal.findFirst({
    where: { id, ...notDeleted },
    include: { stage: { select: { kind: true } } },
  });
  if (!existing) throw ApiError.notFound("Deal not found");
  if (input.ownerId !== undefined) await assertOwnerExists(db, input.ownerId);

  const data: Prisma.DealUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
    ...(input.ownerId !== undefined ? { owner: input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true } } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate } : {}),
  };

  let becameWon = false;
  if (input.stageId && input.stageId !== existing.stageId) {
    // Move within the deal's own pipeline (stage must belong to it).
    const stage = await resolveStage(db, existing.pipelineId, input.stageId);
    data.stage = { connect: { id: input.stageId } };
    const nowTerminal = isTerminal(stage.kind);
    const wasTerminal = isTerminal(existing.stage.kind);
    if (nowTerminal && !wasTerminal) data.closedAt = new Date();
    else if (!nowTerminal && wasTerminal) data.closedAt = null;
    becameWon = stage.kind === StageKind.won && existing.stage.kind !== StageKind.won;
  }

  const deal = await db.deal.update({ where: { id }, data, include: relations });
  opts.log?.debug({ dealId: id }, "db write: deal updated");
  if (becameWon) await promoteClientOnWin(db, deal.clientId, opts.log);
  return deal;
}

export async function softDeleteDeal(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const result = await db.deal.updateMany({
    where: { id, ...notDeleted },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound("Deal not found");
  opts.log?.debug({ dealId: id }, "db write: deal soft-deleted");
}

export interface StageStat {
  stageId: string;
  name: string;
  kind: StageKind;
  sortOrder: number;
  count: number;
  value: number;
}

/**
 * Per-stage count + total value for a pipeline (defaults to the default
 * pipeline). Returns every stage in board order, zero-filled — so empty stages
 * still render as columns.
 */
export async function getPipelineStats(
  pipelineId?: string,
  opts: { db?: Db } = {},
): Promise<StageStat[]> {
  const db = opts.db ?? defaultPrisma;
  const pipeline = pipelineId
    ? await db.pipeline.findUnique({ where: { id: pipelineId }, include: { stages: { orderBy: { sortOrder: "asc" } } } })
    : (await db.pipeline.findFirst({ where: { isDefault: true }, include: { stages: { orderBy: { sortOrder: "asc" } } } })) ??
      (await db.pipeline.findFirst({ where: { archived: false }, include: { stages: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }));
  if (!pipeline) return [];

  const grouped = await db.deal.groupBy({
    by: ["stageId"],
    where: { ...notDeleted, pipelineId: pipeline.id },
    _count: { _all: true },
    _sum: { value: true },
  });
  const byStage = new Map(grouped.map((g) => [g.stageId, g]));
  return pipeline.stages.map((s) => ({
    stageId: s.id,
    name: s.name,
    kind: s.kind,
    sortOrder: s.sortOrder,
    count: byStage.get(s.id)?._count._all ?? 0,
    value: byStage.get(s.id)?._sum.value ?? 0,
  }));
}

/** Winning a deal promotes a still-prospect client to active. */
async function promoteClientOnWin(db: Db, clientId: string, log?: Logger) {
  const res = await db.client.updateMany({
    where: { id: clientId, status: ClientStatus.prospect, deletedAt: null },
    data: { status: ClientStatus.active },
  });
  if (res.count > 0) log?.debug({ clientId }, "client promoted prospect → active on deal win");
}
