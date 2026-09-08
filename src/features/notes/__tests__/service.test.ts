import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNote, deleteNote, listNotes } from "../service";

/**
 * Note service units with a mocked db. Focus: client-active guard, author
 * passthrough, newest-first ordering, and delete 404s.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    note: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
});

describe("listNotes", () => {
  it("scopes to the client and orders newest first", async () => {
    db.note.findMany.mockResolvedValue([]);
    await listNotes("cl1", { db: db as never });
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ clientId: "cl1" });
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });
});

describe("createNote", () => {
  it("404s for a soft-deleted/missing client", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      createNote("gone", { body: "hi" }, "user-1", { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.note.create).not.toHaveBeenCalled();
  });

  it("stamps author and body", async () => {
    db.note.create.mockResolvedValue({ id: "n1" });
    await createNote("cl1", { body: "Called client" }, "user-9", { db: db as never });
    const data = db.note.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clientId: "cl1", body: "Called client", createdById: "user-9" });
  });
});

describe("deleteNote", () => {
  it("404s when nothing matched", async () => {
    db.note.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteNote("n1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("succeeds when a row is deleted", async () => {
    db.note.deleteMany.mockResolvedValue({ count: 1 });
    await expect(deleteNote("n1", { db: db as never })).resolves.toBeUndefined();
  });
});
