import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeliverableStatus } from "@prisma/client";
import {
  createDeliverable,
  updateDeliverable,
  listDeliverables,
  softDeleteDeliverable,
} from "../service";

/**
 * Deliverable service units with a mocked db. Focus: soft-delete filtering,
 * project-active + owner-exists guards, and 404s.
 */
function makeDb() {
  return {
    project: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    deliverable: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.project.findFirst.mockResolvedValue({ id: "pr1" });
  db.user.findUnique.mockResolvedValue({ id: "u1" });
});

describe("listDeliverables", () => {
  it("filters by soft delete + owner + status and sorts by due date", async () => {
    db.deliverable.count.mockResolvedValue(0);
    db.deliverable.findMany.mockResolvedValue([]);
    await listDeliverables(
      { page: 1, pageSize: 25, ownerId: "u1", status: DeliverableStatus.review },
      { db: db as never },
    );
    const call = db.deliverable.findMany.mock.calls[0][0];
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.ownerId).toBe("u1");
    expect(call.where.status).toBe(DeliverableStatus.review);
    expect(call.orderBy[0]).toEqual({ dueDate: { sort: "asc", nulls: "last" } });
  });
});

describe("createDeliverable", () => {
  const base = { title: "Wireframes", status: DeliverableStatus.not_started };

  it("404s when the project is missing/soft-deleted", async () => {
    db.project.findFirst.mockResolvedValue(null);
    await expect(
      createDeliverable("gone", base as never, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.deliverable.create).not.toHaveBeenCalled();
  });

  it("rejects an owner id that isn't a real user", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      createDeliverable("pr1", { ...base, ownerId: "ghost" } as never, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.deliverable.create).not.toHaveBeenCalled();
  });

  it("creates when project + owner are valid", async () => {
    db.deliverable.create.mockResolvedValue({ id: "d1" });
    const out = await createDeliverable("pr1", { ...base, ownerId: "u1" } as never, { db: db as never });
    expect(out).toEqual({ id: "d1" });
    expect(db.deliverable.create.mock.calls[0][0].data.ownerId).toBe("u1");
  });
});

describe("updateDeliverable", () => {
  it("404s when the deliverable is missing", async () => {
    db.deliverable.findFirst.mockResolvedValue(null);
    await expect(
      updateDeliverable("nope", { status: DeliverableStatus.done }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("validates a reassigned owner", async () => {
    db.deliverable.findFirst.mockResolvedValue({ id: "d1" });
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      updateDeliverable("d1", { ownerId: "ghost" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });

  it("allows clearing the owner (ownerId: null) without a user lookup", async () => {
    db.deliverable.findFirst.mockResolvedValue({ id: "d1" });
    db.deliverable.update.mockResolvedValue({ id: "d1", ownerId: null });
    await updateDeliverable("d1", { ownerId: null }, { db: db as never });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("softDeleteDeliverable", () => {
  it("404s when nothing matched", async () => {
    db.deliverable.updateMany.mockResolvedValue({ count: 0 });
    await expect(softDeleteDeliverable("d1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
