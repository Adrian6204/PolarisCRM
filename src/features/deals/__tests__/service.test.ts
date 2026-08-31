import { describe, it, expect, vi, beforeEach } from "vitest";
import { DealStage, ClientStatus } from "@prisma/client";
import {
  createDeal,
  updateDeal,
  listDeals,
  softDeleteDeal,
  getPipelineStats,
} from "../service";

/**
 * Deal service units with a mocked db. Focus: soft-delete filtering, the
 * win→promote-client rule, closedAt transitions, owner/client guards, 404s.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    deal: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
  db.user.findUnique.mockResolvedValue({ id: "u1" });
  db.client.updateMany.mockResolvedValue({ count: 1 });
});

describe("listDeals", () => {
  it("filters by soft delete + stage", async () => {
    db.deal.count.mockResolvedValue(0);
    db.deal.findMany.mockResolvedValue([]);
    await listDeals({ page: 1, pageSize: 25, stage: DealStage.proposal }, { db: db as never });
    const where = db.deal.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.stage).toBe(DealStage.proposal);
  });
});

describe("createDeal", () => {
  it("stamps closedAt when created directly in a terminal stage", async () => {
    db.deal.create.mockResolvedValue({ id: "d1", stage: DealStage.won, clientId: "cl1" });
    await createDeal("cl1", { title: "Big deal", value: 1000, stage: DealStage.won } as never, { db: db as never });
    expect(db.deal.create.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it("does not stamp closedAt for a lead", async () => {
    db.deal.create.mockResolvedValue({ id: "d1", stage: DealStage.lead, clientId: "cl1" });
    await createDeal("cl1", { title: "New", value: 0, stage: DealStage.lead } as never, { db: db as never });
    expect(db.deal.create.mock.calls[0][0].data.closedAt).toBeNull();
  });

  it("promotes a prospect client to active when created as won", async () => {
    db.deal.create.mockResolvedValue({ id: "d1", stage: DealStage.won, clientId: "cl1" });
    await createDeal("cl1", { title: "Won", value: 500, stage: DealStage.won } as never, { db: db as never });
    expect(db.client.updateMany).toHaveBeenCalledWith({
      where: { id: "cl1", status: ClientStatus.prospect, deletedAt: null },
      data: { status: ClientStatus.active },
    });
  });
});

describe("updateDeal", () => {
  it("404s when the deal is missing", async () => {
    db.deal.findFirst.mockResolvedValue(null);
    await expect(
      updateDeal("nope", { stage: DealStage.won }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("stamps closedAt when moving into a terminal stage and promotes on win", async () => {
    db.deal.findFirst.mockResolvedValue({ id: "d1", stage: DealStage.proposal, clientId: "cl1" });
    db.deal.update.mockResolvedValue({ id: "d1", stage: DealStage.won, clientId: "cl1" });
    await updateDeal("d1", { stage: DealStage.won }, { db: db as never });
    expect(db.deal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    expect(db.client.updateMany).toHaveBeenCalled();
  });

  it("clears closedAt when moving back out of a terminal stage", async () => {
    db.deal.findFirst.mockResolvedValue({ id: "d1", stage: DealStage.lost, clientId: "cl1" });
    db.deal.update.mockResolvedValue({ id: "d1", stage: DealStage.lead, clientId: "cl1" });
    await updateDeal("d1", { stage: DealStage.lead }, { db: db as never });
    expect(db.deal.update.mock.calls[0][0].data.closedAt).toBeNull();
    // reopening isn't a win → no client promotion
    expect(db.client.updateMany).not.toHaveBeenCalled();
  });
});

describe("softDeleteDeal", () => {
  it("404s when nothing matched", async () => {
    db.deal.updateMany.mockResolvedValue({ count: 0 });
    await expect(softDeleteDeal("d1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("getPipelineStats", () => {
  it("maps groupBy count + value sum per stage", async () => {
    db.deal.groupBy.mockResolvedValue([
      { stage: DealStage.lead, _count: { _all: 2 }, _sum: { value: 3000 } },
      { stage: DealStage.won, _count: { _all: 1 }, _sum: { value: 5000 } },
    ]);
    const out = await getPipelineStats({ db: db as never });
    expect(out).toEqual([
      { stage: DealStage.lead, count: 2, value: 3000 },
      { stage: DealStage.won, count: 1, value: 5000 },
    ]);
  });
});
