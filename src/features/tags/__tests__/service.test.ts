import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTag, assignTag, unassignTag, tagsForClient } from "../service";

/**
 * Tag service units with a mocked db. Focus: case-insensitive name uniqueness,
 * assign-by-id vs create-and-assign-by-name, idempotent upsert, and the
 * client-active guard on assign.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    tag: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    clientTag: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
  db.tag.findUnique.mockResolvedValue({ id: "t1", name: "VIP", color: "amber" });
});

describe("createTag", () => {
  it("rejects a name that already exists (case-insensitive)", async () => {
    db.tag.findFirst.mockResolvedValue({ id: "t1", name: "vip" });
    await expect(
      createTag({ name: "VIP", color: "slate" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(db.tag.create).not.toHaveBeenCalled();
  });

  it("creates when the name is free", async () => {
    db.tag.findFirst.mockResolvedValue(null);
    db.tag.create.mockResolvedValue({ id: "t2" });
    await createTag({ name: "New", color: "green" }, { db: db as never });
    expect(db.tag.create.mock.calls[0][0].data).toMatchObject({ name: "New", color: "green" });
  });
});

describe("assignTag", () => {
  it("404s for a soft-deleted/missing client", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      assignTag("gone", { tagId: "t1" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.clientTag.upsert).not.toHaveBeenCalled();
  });

  it("assigns an existing tag by id (idempotent upsert)", async () => {
    await assignTag("cl1", { tagId: "t1" }, { db: db as never });
    expect(db.clientTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId_tagId: { clientId: "cl1", tagId: "t1" } } }),
    );
    expect(db.tag.create).not.toHaveBeenCalled();
  });

  it("reuses an existing tag when assigning by name", async () => {
    db.tag.findFirst.mockResolvedValue({ id: "t9" });
    await assignTag("cl1", { name: "vip" }, { db: db as never });
    expect(db.tag.create).not.toHaveBeenCalled();
    expect(db.clientTag.upsert.mock.calls[0][0].where.clientId_tagId.tagId).toBe("t9");
  });

  it("creates the tag when assigning by a new name", async () => {
    db.tag.findFirst.mockResolvedValue(null);
    db.tag.create.mockResolvedValue({ id: "t-new" });
    await assignTag("cl1", { name: "Fresh" }, { db: db as never });
    expect(db.tag.create.mock.calls[0][0].data).toMatchObject({ name: "Fresh", color: "slate" });
    expect(db.clientTag.upsert.mock.calls[0][0].where.clientId_tagId.tagId).toBe("t-new");
  });
});

describe("unassignTag", () => {
  it("deletes the join row", async () => {
    db.clientTag.deleteMany.mockResolvedValue({ count: 1 });
    await unassignTag("cl1", "t1", { db: db as never });
    expect(db.clientTag.deleteMany).toHaveBeenCalledWith({ where: { clientId: "cl1", tagId: "t1" } });
  });
});

describe("tagsForClient", () => {
  it("returns the joined tags in name order", async () => {
    db.clientTag.findMany.mockResolvedValue([{ tag: { id: "t1", name: "A" } }, { tag: { id: "t2", name: "B" } }]);
    const tags = await tagsForClient("cl1", { db: db as never });
    expect(tags).toEqual([{ id: "t1", name: "A" }, { id: "t2", name: "B" }]);
  });
});
