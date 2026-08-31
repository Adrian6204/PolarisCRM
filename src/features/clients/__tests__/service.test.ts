import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientStatus } from "@prisma/client";
import {
  createClient,
  getClient,
  listClients,
  softDeleteClient,
  updateClient,
} from "../service";
import { ApiError } from "@/lib/errors";

/**
 * Unit tests for the client service. A hand-rolled mock `db` is injected so the
 * soft-delete filtering and 404 behaviour are asserted without a real database.
 */
function makeDb() {
  return {
    client: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    // Present so the Phase 7 audit path has something to write to.
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit1" }) },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("listClients", () => {
  it("filters out soft-deleted rows and applies status + search", async () => {
    db.client.count.mockResolvedValue(1);
    db.client.findMany.mockResolvedValue([{ id: "c1" }]);

    const result = await listClients(
      { page: 2, pageSize: 10, status: ClientStatus.active, q: "acme" },
      { db: db as never },
    );

    expect(result).toEqual({ items: [{ id: "c1" }], total: 1, page: 2, pageSize: 10 });
    // deletedAt:null must be present on both count and page queries.
    const where = db.client.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.status).toBe(ClientStatus.active);
    expect(where.name).toEqual({ contains: "acme", mode: "insensitive" });
    // page 2, size 10 → skip 10.
    expect(db.client.findMany.mock.calls[0][0]).toMatchObject({ skip: 10, take: 10 });
  });
});

describe("getClient", () => {
  it("returns the client when found", async () => {
    db.client.findFirst.mockResolvedValue({ id: "c1" });
    await expect(getClient("c1", { db: db as never })).resolves.toEqual({ id: "c1" });
    expect(db.client.findFirst.mock.calls[0][0].where).toEqual({ id: "c1", deletedAt: null });
  });

  it("throws 404 when missing or soft-deleted", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(getClient("nope", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("createClient", () => {
  it("persists and returns the client", async () => {
    db.client.create.mockResolvedValue({ id: "c1", name: "Acme" });
    const out = await createClient(
      { name: "Acme", status: ClientStatus.prospect },
      { db: db as never },
    );
    expect(out).toEqual({ id: "c1", name: "Acme" });
  });

  it("records an audit entry when an actor is supplied", async () => {
    db.client.create.mockResolvedValue({ id: "c1", name: "Acme" });
    await createClient(
      { name: "Acme", status: ClientStatus.prospect },
      { db: db as never, actorId: "user-7" },
    );
    expect(db.auditLog.create).toHaveBeenCalledOnce();
    const data = db.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      entityType: "client",
      entityId: "c1",
      action: "create",
      changedById: "user-7",
    });
  });

  it("does NOT audit when no actor is supplied", async () => {
    db.client.create.mockResolvedValue({ id: "c1", name: "Acme" });
    await createClient({ name: "Acme", status: ClientStatus.prospect }, { db: db as never });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("propagates an audit-write failure (atomic: no silent success)", async () => {
    // Phase 9: audit is written inside the mutation's transaction, so a failure
    // rolls the write back rather than being swallowed.
    db.client.create.mockResolvedValue({ id: "c1", name: "Acme" });
    db.auditLog.create.mockRejectedValue(new Error("audit down"));
    await expect(
      createClient({ name: "Acme", status: ClientStatus.prospect }, { db: db as never, actorId: "u7" }),
    ).rejects.toThrow("audit down");
  });
});

describe("updateClient", () => {
  it("404s when no non-deleted row matches", async () => {
    db.client.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      updateClient("c1", { name: "New" }, { db: db as never }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(db.client.findFirst).not.toHaveBeenCalled();
  });

  it("re-reads and returns the client after a successful update", async () => {
    db.client.updateMany.mockResolvedValue({ count: 1 });
    db.client.findFirst.mockResolvedValue({ id: "c1", name: "New" });
    const out = await updateClient("c1", { name: "New" }, { db: db as never });
    expect(out).toEqual({ id: "c1", name: "New" });
    expect(db.client.updateMany.mock.calls[0][0].where).toEqual({ id: "c1", deletedAt: null });
  });
});

describe("softDeleteClient", () => {
  it("sets deletedAt via updateMany scoped to non-deleted rows", async () => {
    db.client.updateMany.mockResolvedValue({ count: 1 });
    await softDeleteClient("c1", { db: db as never });
    const call = db.client.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "c1", deletedAt: null });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it("404s when already deleted", async () => {
    db.client.updateMany.mockResolvedValue({ count: 0 });
    await expect(softDeleteClient("c1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
