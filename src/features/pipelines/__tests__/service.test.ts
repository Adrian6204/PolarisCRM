import { describe, it, expect, vi, beforeEach } from "vitest";
import { StageKind } from "@prisma/client";
import {
  createPipeline,
  updatePipeline,
  deletePipeline,
  addStage,
  deleteStage,
  reorderStages,
} from "../service";

/**
 * Pipeline service units with a mocked db. Focus: default-stage seeding,
 * single-default invariant, delete guards (pipeline/stage still carrying
 * deals), stage append ordering, and reorder validation.
 */
function makeDb() {
  const db = {
    pipeline: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    pipelineStage: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    deal: { count: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
  };
  return db;
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createPipeline", () => {
  it("seeds the default stage set when none provided", async () => {
    db.pipeline.create.mockResolvedValue({ id: "pl1" });
    await createPipeline({ name: "Sales" }, { db: db as never });
    const stages = db.pipeline.create.mock.calls[0][0].data.stages.create;
    expect(stages.map((s: { name: string }) => s.name)).toEqual(["Lead", "Proposal", "Won", "Lost"]);
    expect(stages[3]).toMatchObject({ kind: StageKind.lost, sortOrder: 3 });
  });

  it("uses supplied stages with sequential order", async () => {
    db.pipeline.create.mockResolvedValue({ id: "pl1" });
    await createPipeline(
      { name: "Onboarding", stages: [{ name: "Kickoff", kind: StageKind.open }, { name: "Live", kind: StageKind.won }] },
      { db: db as never },
    );
    const stages = db.pipeline.create.mock.calls[0][0].data.stages.create;
    expect(stages).toEqual([
      { name: "Kickoff", kind: StageKind.open, sortOrder: 0 },
      { name: "Live", kind: StageKind.won, sortOrder: 1 },
    ]);
  });
});

describe("updatePipeline", () => {
  it("demotes other defaults when setting a new default", async () => {
    db.pipeline.updateMany.mockResolvedValue({ count: 1 });
    db.pipeline.findUnique.mockResolvedValue({ id: "pl1" });
    await updatePipeline("pl1", { isDefault: true }, { db: db as never });
    // First updateMany clears other defaults, second applies the change.
    expect(db.pipeline.updateMany.mock.calls[0][0].where).toMatchObject({ isDefault: true, NOT: { id: "pl1" } });
  });

  it("404s when the pipeline is missing", async () => {
    db.pipeline.updateMany.mockResolvedValue({ count: 0 });
    await expect(updatePipeline("nope", { name: "x" }, { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("deletePipeline", () => {
  it("refuses while deals remain", async () => {
    db.deal.count.mockResolvedValue(3);
    await expect(deletePipeline("pl1", { db: db as never })).rejects.toMatchObject({ code: "conflict" });
    expect(db.pipeline.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes when empty", async () => {
    db.deal.count.mockResolvedValue(0);
    db.pipeline.deleteMany.mockResolvedValue({ count: 1 });
    await expect(deletePipeline("pl1", { db: db as never })).resolves.toBeUndefined();
  });
});

describe("addStage", () => {
  it("appends after the current last stage", async () => {
    db.pipeline.findUnique.mockResolvedValue({ id: "pl1" });
    db.pipelineStage.findFirst.mockResolvedValue({ sortOrder: 4 });
    db.pipelineStage.create.mockResolvedValue({ id: "s9" });
    await addStage("pl1", { name: "Negotiation", kind: StageKind.open }, { db: db as never });
    expect(db.pipelineStage.create.mock.calls[0][0].data.sortOrder).toBe(5);
  });
});

describe("deleteStage", () => {
  it("refuses while the stage carries deals", async () => {
    db.deal.count.mockResolvedValue(1);
    await expect(deleteStage("s1", { db: db as never })).rejects.toMatchObject({ code: "conflict" });
    expect(db.pipelineStage.deleteMany).not.toHaveBeenCalled();
  });
});

describe("reorderStages", () => {
  it("rejects an id set that isn't exactly the pipeline's stages", async () => {
    db.pipelineStage.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(reorderStages("pl1", ["a", "zzz"], { db: db as never })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("writes sequential sortOrder for the given order", async () => {
    db.pipelineStage.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    db.pipelineStage.update.mockResolvedValue({});
    await reorderStages("pl1", ["b", "a"], { db: db as never });
    expect(db.pipelineStage.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { sortOrder: 0 } });
    expect(db.pipelineStage.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { sortOrder: 1 } });
  });
});
