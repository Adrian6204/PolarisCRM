import { describe, it, expect, vi } from "vitest";
import { EngagementType, ProjectStatus } from "@prisma/client";
import { daysUntil, getUpcomingRenewals } from "../service";

describe("daysUntil", () => {
  const now = new Date("2026-08-31T12:00:00Z");
  it("is 0 for today, positive for future, negative for past", () => {
    expect(daysUntil(new Date("2026-08-31T23:00:00Z"), now)).toBe(0);
    expect(daysUntil(new Date("2026-09-15T00:00:00Z"), now)).toBe(15);
    expect(daysUntil(new Date("2026-08-28T00:00:00Z"), now)).toBe(-3);
  });
});

describe("getUpcomingRenewals", () => {
  it("filters to active, non-deleted retainers within the window and adds daysUntil", async () => {
    const now = new Date("2026-08-31T00:00:00Z");
    const db = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "p1",
            name: "SEO Retainer",
            serviceType: "seo",
            retainerRenewalDate: new Date("2026-09-15T00:00:00Z"),
            client: { id: "c1", name: "Northwind" },
          },
        ]),
      },
    };

    const out = await getUpcomingRenewals(30, { db: db as never, now });

    const where = db.project.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.engagementType).toBe(EngagementType.retainer);
    expect(where.status).toBe(ProjectStatus.active);
    expect(where.retainerRenewalDate.gte).toEqual(now);
    // window end = now + 30 days
    expect(where.retainerRenewalDate.lte).toEqual(new Date("2026-09-30T00:00:00Z"));
    // sorted soonest-first
    expect(db.project.findMany.mock.calls[0][0].orderBy).toEqual({
      retainerRenewalDate: "asc",
    });

    expect(out[0].daysUntil).toBe(15);
  });
});
