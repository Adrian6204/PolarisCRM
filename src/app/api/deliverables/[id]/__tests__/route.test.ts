import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ApiError } from "@/lib/errors";

/**
 * Integration tests for PATCH /api/deliverables/:id — verifying the split auth
 * policy: a status-only change is allowed for any authenticated user, while a
 * structural edit (title/owner/dueDate) requires a write role.
 */
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/deliverables/service", () => ({
  updateDeliverable: vi.fn(),
  getDeliverable: vi.fn(),
  softDeleteDeliverable: vi.fn(),
}));

import { PATCH } from "../route";
import { requireUser, requireRole } from "@/lib/auth";
import { updateDeliverable } from "@/features/deliverables/service";

const ctx = { params: Promise.resolve({ id: "d1" }) };
const patch = (body: unknown) =>
  new NextRequest("http://localhost/api/deliverables/d1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/deliverables/:id", () => {
  it("lets any authenticated user change status only (no role check)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.team_member });
    (updateDeliverable as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "d1", status: "done" });

    const res = await PATCH(patch({ status: "done" }), ctx);
    expect(res.status).toBe(200);
    expect(requireRole).not.toHaveBeenCalled();
    expect(updateDeliverable).toHaveBeenCalled();
  });

  it("requires a write role for a structural edit (title)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.team_member });
    (requireRole as ReturnType<typeof vi.fn>).mockRejectedValue(ApiError.forbidden());

    const res = await PATCH(patch({ title: "Renamed" }), ctx);
    expect(res.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(Role.admin, Role.project_lead);
    expect(updateDeliverable).not.toHaveBeenCalled();
  });

  it("requires a write role when status is combined with another field", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.team_member });
    (requireRole as ReturnType<typeof vi.fn>).mockRejectedValue(ApiError.forbidden());

    const res = await PATCH(patch({ status: "done", dueDate: "2026-02-01" }), ctx);
    expect(res.status).toBe(403);
  });

  it("422s on an invalid status value", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    const res = await PATCH(patch({ status: "nope" }), ctx);
    expect(res.status).toBe(422);
  });
});
