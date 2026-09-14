import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * resolveApiKey maps a raw bearer token to its owning actor, failing closed
 * (uniform 401) for missing, revoked, or deactivated-owner keys. The prisma
 * singleton is mocked so these are pure unit tests.
 */
const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({
  prisma: { apiKey: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}));

import { resolveApiKey, bearerFromHeader } from "../auth";
import { generateApiKey } from "../keys";

const RAW = generateApiKey().raw;

function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    revokedAt: null,
    expiresAt: null,
    user: { id: "u1", email: "a@b.co", role: "admin", active: true },
    ...overrides,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  update.mockClear();
});

describe("resolveApiKey", () => {
  it("resolves a valid key to its actor and touches lastUsed", async () => {
    findUnique.mockResolvedValue(keyRow());
    const actor = await resolveApiKey(RAW);
    expect(actor).toMatchObject({ id: "u1", email: "a@b.co", role: "admin", keyId: "key-1" });
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects a malformed token without hitting the db", async () => {
    await expect(resolveApiKey("not-a-key")).rejects.toMatchObject({ code: "unauthorized" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown key", async () => {
    findUnique.mockResolvedValue(null);
    await expect(resolveApiKey(RAW)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("rejects a revoked key", async () => {
    findUnique.mockResolvedValue(keyRow({ revokedAt: new Date() }));
    await expect(resolveApiKey(RAW)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("rejects an expired key", async () => {
    findUnique.mockResolvedValue(keyRow({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(resolveApiKey(RAW)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("accepts a key whose expiry is still in the future", async () => {
    findUnique.mockResolvedValue(keyRow({ expiresAt: new Date(Date.now() + 60_000) }));
    await expect(resolveApiKey(RAW)).resolves.toMatchObject({ id: "u1" });
  });

  it("rejects a key whose owner is deactivated", async () => {
    findUnique.mockResolvedValue(keyRow({ user: { id: "u1", email: "a@b.co", role: "admin", active: false } }));
    await expect(resolveApiKey(RAW)).rejects.toMatchObject({ code: "unauthorized" });
  });
});

describe("bearerFromHeader", () => {
  it("extracts a bearer token case-insensitively", () => {
    expect(bearerFromHeader("Bearer abc123")).toBe("abc123");
    expect(bearerFromHeader("bearer xyz")).toBe("xyz");
  });
  it("returns null for missing or non-bearer schemes", () => {
    expect(bearerFromHeader(null)).toBeNull();
    expect(bearerFromHeader("Basic abc")).toBeNull();
    expect(bearerFromHeader("Bearer")).toBeNull();
  });
});
