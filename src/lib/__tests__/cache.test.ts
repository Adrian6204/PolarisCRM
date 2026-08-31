import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Cache helper tests. The redis module is mocked so we can exercise hit/miss,
 * write, invalidation, and the degrade-open path deterministically.
 */
const redisMock = vi.hoisted(() => ({
  current: null as null | { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> },
}));

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisMock.current;
  },
}));

import { cacheGetOrSet, cacheInvalidate } from "../cache";

function makeRedis() {
  return { get: vi.fn(), set: vi.fn(), del: vi.fn() };
}

beforeEach(() => {
  redisMock.current = makeRedis();
});

describe("cacheGetOrSet", () => {
  it("returns the cached value on a hit without computing", async () => {
    redisMock.current!.get.mockResolvedValue({ n: 1 });
    const compute = vi.fn();
    const out = await cacheGetOrSet("k", 60, compute);
    expect(out).toEqual({ n: 1 });
    expect(compute).not.toHaveBeenCalled();
  });

  it("computes and stores on a miss", async () => {
    redisMock.current!.get.mockResolvedValue(null);
    const out = await cacheGetOrSet("k", 60, async () => ({ n: 2 }));
    expect(out).toEqual({ n: 2 });
    expect(redisMock.current!.set).toHaveBeenCalledWith("k", { n: 2 }, { ex: 60 });
  });

  it("degrades open (computes) when Redis is unconfigured", async () => {
    redisMock.current = null;
    const out = await cacheGetOrSet("k", 60, async () => "fresh");
    expect(out).toBe("fresh");
  });

  it("falls through to compute when the cache read throws", async () => {
    redisMock.current!.get.mockRejectedValue(new Error("boom"));
    const out = await cacheGetOrSet("k", 60, async () => "fresh");
    expect(out).toBe("fresh");
  });
});

describe("cacheInvalidate", () => {
  it("deletes the given keys", async () => {
    await cacheInvalidate("a", "b");
    expect(redisMock.current!.del).toHaveBeenCalledWith("a", "b");
  });

  it("no-ops without keys or Redis", async () => {
    await cacheInvalidate();
    expect(redisMock.current!.del).not.toHaveBeenCalled();
    redisMock.current = null;
    await expect(cacheInvalidate("a")).resolves.toBeUndefined();
  });
});
