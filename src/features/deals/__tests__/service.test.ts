import { describe, it, expect, vi, beforeEach } from "vitest";
import { StageKind, ClientStatus } from "@prisma/client";
import {
  createDeal,
  updateDeal,
  listDeals,
  softDeleteDeal,
  getPipelineStats,
} from "../service";

/**
 * Deal service units with a mocked db. Focus: soft-delete filtering, the
 * win→promote-client rule (stage kind = won), closedAt transitions, the
 * stage-belongs-to-pipeline guard, owner/client guards, and 404s.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    pipeline: { findFirst: vi.fn(), findUnique: vi.fn() },
    pipelineStage: { findUnique: vi.fn() },
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

const stage = (id: string, kind: StageKind) => ({ id, pipelineId: "pl1", kind });

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
  db.user.findUnique.mockResolvedValue({ id: "u1" });
  db.client.updateMany.mockResolvedValue({ count: 1 });
});

describe("listDeals", () => {
  it("filters by soft delete + pipeline + stage", async () => {
    db.deal.count.mockResolvedValue(0);
    db.deal.findMany.mockResolvedValue([]);
    await listDeals({ page: 1, pageSize: 25, pipelineId: "pl1", stageId: "st2" }, { db: db as never });
    const where = db.deal.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.pipelineId).toBe("pl1");
    expect(where.stageId).toBe("st2");
  });
});

describe("createDeal", () => {
  const base = { title: "Deal", value: 1000, pipelineId: "pl1", ownerId: null };

  it("stamps closedAt when created directly in a terminal stage", async () => {
    db.pipelineStage.findUnique.mockResolvedValue(stage("st_won", StageKind.won));
    db.deal.create.mockResolvedValue({ id: "d1", clientId: "cl1" });
    await createDeal("cl1", { ...base, stageId: "st_won" } as never, { db: db as never });
    expect(db.deal.create.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it("does not stamp closedAt for an open stage", async () => {
    db.pipelineStage.findUnique.mockResolvedValue(stage("st_lead", StageKind.open));
    db.deal.create.mockResolvedValue({ id: "d1", clientId: "cl1" });
    await createDeal("cl1", { ...base, stageId: "st_lead" } as never, { db: db as never });
    expect(db.deal.create.mock.calls[0][0].data.closedAt).toBeNull();
  });

  it("rejects a stage that belongs to another pipeline", async () => {
    db.pipelineStage.findUnique.mockResolvedValue({ id: "x", pipelineId: "OTHER", kind: StageKind.open });
    await expect(
      createDeal("cl1", { ...base, stageId: "x" } as never, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.deal.create).not.toHaveBeenCalled();
  });

  it("promotes a prospect client to active when created as won", async () => {
    db.pipelineStage.findUnique.mockResolvedValue(stage("st_won", StageKind.won));
    db.deal.create.mockResolvedValue({ id: "d1", clientId: "cl1" });
    await createDeal("cl1", { ...base, stageId: "st_won" } as never, { db: db as never });
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
      updateDeal("nope", { stageId: "st_won" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("stamps closedAt when moving into a terminal stage and promotes on win", async () => {
    db.deal.findFirst.mockResolvedValue({ id: "d1", clientId: "cl1", pipelineId: "pl1", stageId: "st_prop", stage: { kind: StageKind.open } });
    db.pipelineStage.findUnique.mockResolvedValue(stage("st_won", StageKind.won));
    db.deal.update.mockResolvedValue({ id: "d1", clientId: "cl1" });
    await updateDeal("d1", { stageId: "st_won" }, { db: db as never });
    expect(db.deal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    expect(db.client.updateMany).toHaveBeenCalled();
  });

  it("clears closedAt when moving back out of a terminal stage", async () => {
    db.deal.findFirst.mockResolvedValue({ id: "d1", clientId: "cl1", pipelineId: "pl1", stageId: "st_lost", stage: { kind: StageKind.lost } });
    db.pipelineStage.findUnique.mockResolvedValue(stage("st_lead", StageKind.open));
    db.deal.update.mockResolvedValue({ id: "d1", clientId: "cl1" });
    await updateDeal("d1", { stageId: "st_lead" }, { db: db as never });
    expect(db.deal.update.mock.calls[0][0].data.closedAt).toBeNull();
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
  it("zero-fills every stage of the pipeline in board order", async () => {
    db.pipeline.findUnique.mockResolvedValue({
      id: "pl1",
      stages: [
        { id: "st_lead", name: "Lead", kind: StageKind.open, sortOrder: 0 },
        { id: "st_won", name: "Won", kind: StageKind.won, sortOrder: 1 },
      ],
    });
    db.deal.groupBy.mockResolvedValue([
      { stageId: "st_lead", _count: { _all: 2 }, _sum: { value: 3000 } },
    ]);
    const out = await getPipelineStats("pl1", { db: db as never });
    expect(out).toEqual([
      { stageId: "st_lead", name: "Lead", kind: StageKind.open, sortOrder: 0, count: 2, value: 3000 },
      { stageId: "st_won", name: "Won", kind: StageKind.won, sortOrder: 1, count: 0, value: 0 },
    ]);
  });
});
