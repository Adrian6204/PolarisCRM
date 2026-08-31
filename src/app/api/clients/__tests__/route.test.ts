import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ApiError } from "@/lib/errors";

/**
 * Integration tests for the /api/clients route handlers. Auth and the service
 * layer are mocked so these exercise the full HTTP path — the withApiRoute
 * wrapper, Zod validation, auth gating, status codes, error envelope, and the
 * x-request-id response header — without a database.
 */
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/features/clients/service", () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
}));

import { GET, POST } from "../route";
import { requireUser, requireRole } from "@/lib/auth";
import { listClients, createClient } from "@/features/clients/service";

const noParams = { params: Promise.resolve({} as Record<string, string>) };

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/clients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/clients", () => {
  it("returns 200 with the paginated envelope for an authed user", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.team_member });
    (listClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{ id: "c1" }],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    const res = await GET(new NextRequest("http://localhost/api/clients"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
  });

  it("passes query filters through to the service", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1" });
    (listClients as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });

    await GET(
      new NextRequest("http://localhost/api/clients?status=active&q=acme&page=2"),
      noParams,
    );
    expect(listClients).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", q: "acme", page: 2 }),
    );
  });
});

describe("POST /api/clients", () => {
  it("403s when the caller lacks a write role", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockRejectedValue(ApiError.forbidden());
    const res = await POST(jsonReq({ name: "Acme" }), noParams);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("forbidden");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("422s on invalid input (missing name)", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    const res = await POST(jsonReq({ industry: "SaaS" }), noParams);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("422s on a malformed website URL", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    const res = await POST(jsonReq({ name: "Acme", website: "not-a-url" }), noParams);
    expect(res.status).toBe(422);
  });

  it("creates and returns 201 for a valid admin request", async () => {
    (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", role: Role.admin });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1", name: "Acme" });

    const res = await POST(jsonReq({ name: "Acme", status: "active" }), noParams);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "c1", name: "Acme" });
    expect(createClient).toHaveBeenCalledOnce();
  });
});
