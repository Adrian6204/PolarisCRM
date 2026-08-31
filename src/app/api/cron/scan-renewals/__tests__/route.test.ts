import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Auth tests for the Vercel Cron endpoint. env + inngest are mocked so we can
 * toggle CRON_SECRET / isProd and assert the event is (or isn't) emitted.
 */
// vi.hoisted so the mutable state exists before the hoisted vi.mock factory runs.
const state = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  isProd: false,
}));

vi.mock("@/lib/env", () => ({
  get env() {
    return { CRON_SECRET: state.CRON_SECRET };
  },
  get isProd() {
    return state.isProd;
  },
}));
vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn() },
  EVENTS: { renewalsScanRequested: "renewals/scan.requested" },
}));

import { GET } from "../route";
import { inngest } from "@/lib/inngest";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/scan-renewals", {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  state.CRON_SECRET = undefined;
  state.isProd = false;
});

describe("GET /api/cron/scan-renewals", () => {
  it("enqueues the scan when the secret matches", async () => {
    state.CRON_SECRET = "s3cret";
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "renewals/scan.requested" }),
    );
  });

  it("rejects a wrong/missing secret with 401", async () => {
    state.CRON_SECRET = "s3cret";
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("fails closed with 500 in production when no secret is configured", async () => {
    state.isProd = true;
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("runs open locally when no secret is set (dev convenience)", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(inngest.send).toHaveBeenCalled();
  });
});
