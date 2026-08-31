import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

/**
 * Integration tests for POST /api/clients/:id/activities — verifying any authed
 * user can log activity and that created_by is taken from the session, not the
 * body.
 */
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/activities/service", () => ({
  createActivity: vi.fn(),
  listActivities: vi.fn(),
}));

import { POST } from "../route";
import { requireUser } from "@/lib/auth";
import { createActivity } from "@/features/activities/service";

const ctx = { params: Promise.resolve({ id: "cl1" }) };
const req = (body: unknown) =>
  new NextRequest("http://localhost/api/clients/cl1/activities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/clients/:id/activities", () => {
  it("lets a team member log activity, stamping created_by from the session", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u-42", role: Role.team_member });
    (createActivity as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });

    const res = await POST(req({ type: "call", summary: "Intro call" }), ctx);
    expect(res.status).toBe(201);
    // clientId from path, input, then the session user id as created_by.
    expect(createActivity).toHaveBeenCalledWith(
      "cl1",
      expect.objectContaining({ type: "call", summary: "Intro call" }),
      "u-42",
      expect.anything(),
    );
  });

  it("422s on an invalid type", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u-42", role: Role.team_member });
    const res = await POST(req({ type: "smoke_signal", summary: "x" }), ctx);
    expect(res.status).toBe(422);
    expect(createActivity).not.toHaveBeenCalled();
  });

  it("422s on an empty summary", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u-42", role: Role.team_member });
    const res = await POST(req({ type: "note", summary: "   " }), ctx);
    expect(res.status).toBe(422);
  });
});
