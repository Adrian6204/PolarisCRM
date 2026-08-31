import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityType } from "@prisma/client";
import {
  createActivity,
  listActivities,
  deleteActivity,
} from "../service";

/**
 * Activity service units with a mocked db. Focus: client-active guard,
 * project-belongs-to-client guard, created_by passthrough, chronological
 * ordering, and delete 404s.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    activity: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
  db.project.findFirst.mockResolvedValue({ id: "pr1" });
});

describe("listActivities", () => {
  it("scopes to the client and orders newest first", async () => {
    db.activity.count.mockResolvedValue(0);
    db.activity.findMany.mockResolvedValue([]);
    await listActivities("cl1", { page: 1, pageSize: 25 }, { db: db as never });
    const call = db.activity.findMany.mock.calls[0][0];
    expect(call.where.clientId).toBe("cl1");
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });

  it("404s for a soft-deleted/missing client", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      listActivities("gone", { page: 1, pageSize: 25 }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("createActivity", () => {
  const base = { type: ActivityType.call, summary: "Kickoff call" };

  it("stamps created_by from the caller and defaults project to null", async () => {
    db.activity.create.mockResolvedValue({ id: "a1" });
    await createActivity("cl1", base, "user-9", { db: db as never });
    const data = db.activity.create.mock.calls[0][0].data;
    expect(data.createdById).toBe("user-9");
    expect(data.projectId).toBeNull();
  });

  it("rejects a project that doesn't belong to the client", async () => {
    db.project.findFirst.mockResolvedValue(null);
    await expect(
      createActivity("cl1", { ...base, projectId: "other" }, "user-9", { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.activity.create).not.toHaveBeenCalled();
  });

  it("accepts a project that belongs to the client", async () => {
    db.activity.create.mockResolvedValue({ id: "a1" });
    await createActivity("cl1", { ...base, projectId: "pr1" }, "user-9", { db: db as never });
    expect(db.activity.create.mock.calls[0][0].data.projectId).toBe("pr1");
  });
});

describe("deleteActivity", () => {
  it("404s when nothing matched", async () => {
    db.activity.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteActivity("a1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("succeeds when a row is deleted", async () => {
    db.activity.deleteMany.mockResolvedValue({ count: 1 });
    await expect(deleteActivity("a1", { db: db as never })).resolves.toBeUndefined();
  });
});
