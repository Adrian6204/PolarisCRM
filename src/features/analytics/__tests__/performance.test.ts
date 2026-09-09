import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Performance-report units. The service reads the prisma singleton, so we mock
 * the module. Focus: win-rate math, avg-cycle-days from won deals, and the
 * owner leaderboard sorted by won value with names resolved.
 */
const { deal, activity, user } = vi.hoisted(() => ({
  deal: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  activity: { groupBy: vi.fn() },
  user: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { deal, activity, user } }));

import { getPerformanceReport } from "../service";

beforeEach(() => {
  vi.clearAllMocks();
  user.findMany.mockResolvedValue([{ id: "u1", name: "Ada", email: "a@x.com" }, { id: "u2", name: null, email: "b@x.com" }]);
  activity.groupBy.mockResolvedValue([]);
});

describe("getPerformanceReport", () => {
  it("computes win rate, won value and avg cycle days", async () => {
    deal.count
      .mockResolvedValueOnce(10) // created
      .mockResolvedValueOnce(3) // won
      .mockResolvedValueOnce(1); // lost
    deal.aggregate.mockResolvedValue({ _sum: { value: 9000 } });
    deal.findMany.mockResolvedValue([
      { createdAt: new Date("2026-01-01"), closedAt: new Date("2026-01-11") }, // 10d
      { createdAt: new Date("2026-01-01"), closedAt: new Date("2026-01-05") }, // 4d
    ]);
    deal.groupBy.mockResolvedValue([]);

    const r = await getPerformanceReport({ from: new Date("2026-01-01"), to: new Date("2026-02-01") });
    expect(r.sales.won).toBe(3);
    expect(r.sales.winRate).toBeCloseTo(3 / 4);
    expect(r.sales.wonValue).toBe(9000);
    expect(r.sales.avgCycleDays).toBe(7); // (10 + 4) / 2
  });

  it("builds an owner leaderboard sorted by won value, resolving names", async () => {
    deal.count.mockResolvedValue(0);
    deal.aggregate.mockResolvedValue({ _sum: { value: 0 } });
    deal.findMany.mockResolvedValue([]);
    deal.groupBy.mockResolvedValue([
      { ownerId: "u1", _count: { _all: 1 }, _sum: { value: 500 } },
      { ownerId: "u2", _count: { _all: 2 }, _sum: { value: 3000 } },
    ]);

    const r = await getPerformanceReport({ from: new Date("2026-01-01"), to: new Date("2026-02-01") });
    expect(r.leaderboard.map((l) => l.name)).toEqual(["b@x.com", "Ada"]); // u2 (3000) before u1 (500)
    expect(r.leaderboard[0].wonValue).toBe(3000);
  });

  it("returns null win rate + cycle when nothing closed", async () => {
    deal.count.mockResolvedValue(0);
    deal.aggregate.mockResolvedValue({ _sum: { value: null } });
    deal.findMany.mockResolvedValue([]);
    deal.groupBy.mockResolvedValue([]);
    const r = await getPerformanceReport({ from: new Date(), to: new Date() });
    expect(r.sales.winRate).toBeNull();
    expect(r.sales.avgCycleDays).toBeNull();
  });
});
