import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ApiError } from "@/lib/errors";

/**
 * Integration tests for POST /api/clients/:id/projects — the cross-field stage
 * validation is the interesting bit, exercised through the real wrapper + Zod.
 */
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/projects/service", () => ({
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));

import { POST } from "../route";
import { requireRole } from "@/lib/auth";
import { createProject } from "@/features/projects/service";

const ctx = { params: Promise.resolve({ id: "cl1" }) };
const req = (body: unknown) =>
  new NextRequest("http://localhost/api/clients/cl1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const valid = {
  name: "Site build",
  serviceType: "web_dev",
  engagementType: "one_off",
  startDate: "2026-01-01",
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/clients/:id/projects", () => {
  it("403s for a team member (no write role)", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockRejectedValue(ApiError.forbidden());
    const res = await POST(req(valid), ctx);
    expect(res.status).toBe(403);
    expect(createProject).not.toHaveBeenCalled();
  });

  it("422s when the stage is invalid for the service type", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    const res = await POST(req({ ...valid, stage: "audit" }), ctx); // audit ∉ web_dev
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(createProject).not.toHaveBeenCalled();
  });

  it("422s when a one_off carries a retainer renewal date", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    const res = await POST(req({ ...valid, retainerRenewalDate: "2026-06-01" }), ctx);
    expect(res.status).toBe(422);
  });

  it("creates and returns 201 for valid input", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", name: "Site build" });
    const res = await POST(req(valid), ctx);
    expect(res.status).toBe(201);
    expect(createProject).toHaveBeenCalledWith("cl1", expect.objectContaining({ name: "Site build" }), expect.anything());
  });
});
