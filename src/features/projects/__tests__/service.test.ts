import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceType, EngagementType, ProjectStatus } from "@prisma/client";
import {
  createProject,
  updateProject,
  listProjects,
  softDeleteProject,
} from "../service";

/**
 * Project service units with a mocked db. Focus: soft-delete filtering, stage
 * defaulting on create, and the update-time business rules (stage validity vs
 * the project's own service/engagement type, retainer-only renewal date, date
 * ordering).
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    project: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
});

describe("listProjects", () => {
  it("filters by soft delete + serviceType + status", async () => {
    db.project.count.mockResolvedValue(0);
    db.project.findMany.mockResolvedValue([]);
    await listProjects(
      { page: 1, pageSize: 25, serviceType: ServiceType.seo, status: ProjectStatus.active },
      { db: db as never },
    );
    const where = db.project.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.serviceType).toBe(ServiceType.seo);
    expect(where.status).toBe(ProjectStatus.active);
  });
});

describe("createProject", () => {
  const base = {
    name: "Site build",
    serviceType: ServiceType.web_dev,
    engagementType: EngagementType.one_off,
    startDate: new Date("2026-01-01"),
    status: ProjectStatus.active,
  };

  it("defaults stage to the first in the set when omitted", async () => {
    db.project.create.mockResolvedValue({ id: "p1" });
    await createProject("cl1", base as never, { db: db as never });
    expect(db.project.create.mock.calls[0][0].data.stage).toBe("discovery");
  });

  it("uses the provided stage when given", async () => {
    db.project.create.mockResolvedValue({ id: "p1" });
    await createProject("cl1", { ...base, stage: "qa" } as never, { db: db as never });
    expect(db.project.create.mock.calls[0][0].data.stage).toBe("qa");
  });

  it("404s when the client is missing/soft-deleted", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      createProject("gone", base as never, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.project.create).not.toHaveBeenCalled();
  });
});

describe("updateProject", () => {
  const existing = {
    id: "p1",
    serviceType: ServiceType.web_dev,
    engagementType: EngagementType.one_off,
    startDate: new Date("2026-01-01"),
    endDate: null,
  };

  it("rejects a stage that isn't valid for the project's service type", async () => {
    db.project.findFirst.mockResolvedValue(existing);
    await expect(
      updateProject("p1", { stage: "audit" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.project.update).not.toHaveBeenCalled();
  });

  it("rejects a retainer renewal date on a one_off engagement", async () => {
    db.project.findFirst.mockResolvedValue(existing);
    await expect(
      updateProject("p1", { retainerRenewalDate: new Date("2026-06-01") }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });

  it("rejects an end date before the start date", async () => {
    db.project.findFirst.mockResolvedValue(existing);
    await expect(
      updateProject("p1", { endDate: new Date("2025-12-01") }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });

  it("applies a valid stage transition", async () => {
    db.project.findFirst.mockResolvedValue(existing);
    db.project.update.mockResolvedValue({ id: "p1", stage: "build" });
    const out = await updateProject("p1", { stage: "build" }, { db: db as never });
    expect(out.stage).toBe("build");
  });

  it("404s when the project is missing", async () => {
    db.project.findFirst.mockResolvedValue(null);
    await expect(
      updateProject("nope", { stage: "build" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("softDeleteProject", () => {
  it("404s when nothing matched", async () => {
    db.project.updateMany.mockResolvedValue({ count: 0 });
    await expect(softDeleteProject("p1", { db: db as never })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
