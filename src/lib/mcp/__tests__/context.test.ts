import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { Role } from "@prisma/client";
import { guard, getActor, toShape, type ToolResult } from "../context";
import type { McpActor } from "../auth";

/**
 * The shared tool guard: it resolves the actor from the request's AuthInfo,
 * enforces the same role gate the HTTP routes use, and maps thrown ApiErrors to
 * `isError` results the model can read (never leaking internals).
 */
const actor: McpActor = { id: "u1", email: "a@b.co", role: Role.team_member, keyId: "k1" };
const admin: McpActor = { ...actor, role: Role.admin };
const extraFor = (a?: McpActor) => ({ authInfo: a ? { extra: { actor: a } } : undefined });
const text = (r: ToolResult) => r.content[0]?.text ?? "";

describe("getActor", () => {
  it("returns the actor carried on authInfo", () => {
    expect(getActor(extraFor(actor))).toEqual(actor);
  });
  it("throws unauthorized when absent", () => {
    expect(() => getActor(extraFor())).toThrow();
  });
});

describe("guard", () => {
  it("runs the handler and returns its result for an authorized actor", async () => {
    const handler = vi.fn(
      async (_args: unknown, ctx: { actor: McpActor; log: unknown }) => {
        void ctx;
        return { content: [{ type: "text" as const, text: "ok" }] };
      },
    );
    const tool = guard("t", {}, handler);
    const res = await tool({}, extraFor(actor));
    expect(res.isError).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
    // The resolved actor is threaded into the handler context.
    expect(handler.mock.calls[0][1].actor).toEqual(actor);
  });

  it("returns an auth error result when no actor is present", async () => {
    const tool = guard("t", {}, async () => ({ content: [{ type: "text" as const, text: "ok" }] }));
    const res = await tool({}, extraFor());
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("unauthorized");
  });

  it("blocks an actor whose role isn't permitted", async () => {
    const handler = vi.fn(async () => ({ content: [{ type: "text" as const, text: "ok" }] }));
    const tool = guard("t", { roles: [Role.admin] }, handler);
    const res = await tool({}, extraFor(actor)); // team_member vs admin-only
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("forbidden");
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows an actor whose role is permitted", async () => {
    const tool = guard("t", { roles: [Role.admin] }, async () => ({ content: [{ type: "text" as const, text: "ok" }] }));
    const res = await tool({}, extraFor(admin));
    expect(res.isError).toBeUndefined();
  });

  it("maps a thrown ApiError from the handler to an isError result", async () => {
    const tool = guard("t", {}, async () => {
      const { ApiError } = await import("@/lib/errors");
      throw ApiError.notFound("Client not found");
    });
    const res = await tool({}, extraFor(actor));
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("not_found");
  });
});

describe("toShape", () => {
  it("unwraps a refined (ZodEffects) object schema to its raw shape", () => {
    const schema = z
      .object({ a: z.string(), b: z.number() })
      .refine(() => true, { message: "x" });
    const shape = toShape(schema);
    expect(Object.keys(shape).sort()).toEqual(["a", "b"]);
  });

  it("merges extra fields onto the shape", () => {
    const schema = z.object({ a: z.string() });
    const shape = toShape(schema, { clientId: z.string() });
    expect(Object.keys(shape).sort()).toEqual(["a", "clientId"]);
  });
});
