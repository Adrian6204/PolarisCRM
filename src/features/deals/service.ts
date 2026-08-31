import type { Prisma, PrismaClient } from "@prisma/client";
import { ClientStatus, DealStage } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { toSkipTake } from "@/lib/validation";
import type { ListResult } from "@/features/clients/service";
import type { CreateDealInput, ListDealsQuery, UpdateDealInput } from "./schema";

/**
 * Deal / sales-pipeline business logic (Phase 8). Soft-delete-aware. Terminal
 * stages (won/lost) stamp closedAt; winning a deal promotes a still-prospect
 * client to active — the pre-contract → contract transition the SPEC calls out.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const notDeleted = { deletedAt: null } satisfies Prisma.DealWhereInput;

const relations = {
  owner: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, status: true } },
} as const;

export type DealWithRefs = Prisma.DealGetPayload<{
  include: {
    owner: { select: { id: true; name: true; email: true } };
    client: { select: { id: true; name: true; status: true } };
  };
}>;

const TERMINAL: DealStage[] = [DealStage.won, DealStage.lost];

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

export async function listDeals(
  query: ListDealsQuery,
  opts: { db?: Db } = {},
): Promise<ListResult<DealWithRefs>> {
  const db = opts.db ?? defaultPrisma;
  const where: Prisma.DealWhereInput = {
    ...notDeleted,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.stage ? { stage: query.stage } : {}),
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

  const deal = await db.deal.create({
    data: {
      clientId,
      title: input.title,
      value: input.value,
      stage: input.stage,
      ownerId: input.ownerId ?? null,
      notes: input.notes ?? null,
      expectedCloseDate: input.expectedCloseDate ?? null,
      // If created directly in a terminal stage, stamp the close date.
      closedAt: TERMINAL.includes(input.stage) ? new Date() : null,
    },
    include: relations,
  });
  opts.log?.debug({ dealId: deal.id, clientId }, "db write: deal created");
  if (deal.stage === DealStage.won) await promoteClientOnWin(db, clientId, opts.log);
  return deal;
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const existing = await db.deal.findFirst({ where: { id, ...notDeleted } });
  if (!existing) throw ApiError.notFound("Deal not found");
  if (input.ownerId !== undefined) await assertOwnerExists(db, input.ownerId);

  // Maintain closedAt when the stage moves in/out of a terminal state.
  const data: Prisma.DealUpdateInput = { ...input };
  if (input.stage && input.stage !== existing.stage) {
    const nowTerminal = TERMINAL.includes(input.stage);
    const wasTerminal = TERMINAL.includes(existing.stage);
    if (nowTerminal && !wasTerminal) data.closedAt = new Date();
    else if (!nowTerminal && wasTerminal) data.closedAt = null;
  }

  const deal = await db.deal.update({ where: { id }, data, include: relations });
  opts.log?.debug({ dealId: id }, "db write: deal updated");
  if (input.stage === DealStage.won && existing.stage !== DealStage.won) {
    await promoteClientOnWin(db, deal.clientId, opts.log);
  }
  return deal;
}

export async function softDeleteDeal(
  id: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const result = await db.deal.updateMany({
    where: { id, ...notDeleted },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound("Deal not found");
  opts.log?.debug({ dealId: id }, "db write: deal soft-deleted");
}

/** Aggregate pipeline: count + total value per stage (non-deleted). */
export async function getPipelineStats(opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const grouped = await db.deal.groupBy({
    by: ["stage"],
    where: notDeleted,
    _count: { _all: true },
    _sum: { value: true },
  });
  return grouped.map((g) => ({
    stage: g.stage,
    count: g._count._all,
    value: g._sum.value ?? 0,
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
