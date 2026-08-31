import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceType, ProjectStatus } from "@prisma/client";
import {
  upsertReport,
  deleteReport,
  getServiceLineStats,
} from "../service";

/**
 * Reporting service units with a mocked db. Redis is unconfigured in the test
 * env, so the cache helpers degrade open — these exercise the DB logic and the
 * service-line rollup mapping directly.
 */
function makeDb() {
  return {
    project: { findFirst: vi.fn(), groupBy: vi.fn() },
    reportEntry: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.project.findFirst.mockResolvedValue({ clientId: "cl1" });
});

describe("upsertReport", () => {
  it("upserts by (projectId, period) after resolving the client", async () => {
    db.reportEntry.upsert.mockResolvedValue({ id: "r1" });
    await upsertReport(
      "pr1",
      { period: "2026-08", metrics: { clicks: 100 }, notes: "up" },
      { db: db as never },
    );
    const call = db.reportEntry.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ projectId_period: { projectId: "pr1", period: "2026-08" } });
    expect(call.create.metrics).toEqual({ clicks: 100 });
    expect(call.update.metrics).toEqual({ clicks: 100 });
  });

  it("404s when the project is missing/soft-deleted", async () => {
    db.project.findFirst.mockResolvedValue(null);
    await expect(
      upsertReport("gone", { period: "2026-08", metrics: {} }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.reportEntry.upsert).not.toHaveBeenCalled();
  });
});

describe("deleteReport", () => {
  it("404s when the report is missing", async () => {
    db.reportEntry.findUnique.mockResolvedValue(null);
    await expect(deleteReport("r1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(db.reportEntry.delete).not.toHaveBeenCalled();
  });

  it("deletes and resolves when present", async () => {
    db.reportEntry.findUnique.mockResolvedValue({ id: "r1", project: { clientId: "cl1" } });
    db.reportEntry.delete.mockResolvedValue({ id: "r1" });
    await expect(deleteReport("r1", { db: db as never })).resolves.toBeUndefined();
  });
});

describe("getServiceLineStats", () => {
  it("maps groupBy counts to {serviceType, active} for active projects", async () => {
    db.project.groupBy.mockResolvedValue([
      { serviceType: ServiceType.web_dev, _count: { _all: 3 } },
      { serviceType: ServiceType.seo, _count: { _all: 1 } },
    ]);
    const out = await getServiceLineStats({ db: db as never });
    expect(out).toEqual([
      { serviceType: ServiceType.web_dev, active: 3 },
      { serviceType: ServiceType.seo, active: 1 },
    ]);
    // Only active, non-deleted projects are counted.
    const where = db.project.groupBy.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null, status: ProjectStatus.active });
  });
});
