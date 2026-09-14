import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiKey, listApiKeys, revokeApiKey } from "../service";

/**
 * API-key service units with a mocked db. Focus: only a hash (never the raw key)
 * is persisted, the one-time raw secret is returned, and revocation is
 * owner-scoped and 404s when nothing matches.
 */
function makeDb() {
  return {
    apiKey: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createApiKey", () => {
  it("persists a hash + prefix (never the raw key) and returns the raw once", async () => {
    db.apiKey.create.mockImplementation(async ({ data, select }: never) => ({
      id: "k1",
      name: (data as { name: string }).name,
      prefix: (data as { prefix: string }).prefix,
      lastUsed: null,
      revokedAt: null,
      createdAt: new Date(),
      ...(select ? {} : {}),
    }));

    const { raw, summary } = await createApiKey("u1", { name: "Laptop" }, { db: db as never });

    const data = db.apiKey.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: "u1", name: "Laptop" });
    expect(data.hash).toHaveLength(64);
    // The raw secret must not be written to the row.
    expect(JSON.stringify(data)).not.toContain(raw);
    expect(raw.startsWith("pcrm_")).toBe(true);
    expect(summary.id).toBe("k1");
  });

  it("stores no expiry by default and a computed expiry when days are given", async () => {
    db.apiKey.create.mockResolvedValue({ id: "k1" });

    await createApiKey("u1", { name: "no-expiry" }, { db: db as never });
    expect(db.apiKey.create.mock.calls[0][0].data.expiresAt).toBeNull();

    const before = Date.now();
    await createApiKey("u1", { name: "30d", expiresInDays: 30 }, { db: db as never });
    const expiresAt = db.apiKey.create.mock.calls[1][0].data.expiresAt as Date;
    const days = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe("listApiKeys", () => {
  it("scopes to the user and never selects the hash", async () => {
    db.apiKey.findMany.mockResolvedValue([]);
    await listApiKeys("u1", { db: db as never });
    const call = db.apiKey.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "u1" });
    expect(call.select.hash).toBeUndefined();
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });
});

describe("revokeApiKey", () => {
  it("is owner-scoped and 404s when nothing matched", async () => {
    db.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(revokeApiKey("u1", "k1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
    expect(db.apiKey.updateMany.mock.calls[0][0].where).toMatchObject({ id: "k1", userId: "u1", revokedAt: null });
  });

  it("resolves when a row is revoked", async () => {
    db.apiKey.updateMany.mockResolvedValue({ count: 1 });
    await expect(revokeApiKey("u1", "k1", { db: db as never })).resolves.toBeUndefined();
  });
});
