import { describe, it, expect, vi } from "vitest";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { computeDiff, recordAudit } from "../service";

describe("computeDiff", () => {
  it("create → { after } with Dates as ISO and volatile/relation fields dropped", () => {
    const diff = computeDiff(
      AuditAction.create,
      null,
      { id: "c1", name: "Acme", createdAt: new Date("2026-01-01"), contacts: [{ id: "x" }] },
    ) as { after: Record<string, unknown> };
    expect(diff.after).toEqual({ id: "c1", name: "Acme" });
    expect(diff.after.createdAt).toBeUndefined();
    expect(diff.after.contacts).toBeUndefined();
  });

  it("delete → { before }", () => {
    const diff = computeDiff(AuditAction.delete, { id: "c1", name: "Acme" }, null) as {
      before: Record<string, unknown>;
    };
    expect(diff.before).toEqual({ id: "c1", name: "Acme" });
  });

  it("update → only changed scalar fields as {from,to}", () => {
    const diff = computeDiff(
      AuditAction.update,
      { id: "p1", name: "Old", status: "active", stage: "build" },
      { id: "p1", name: "New", status: "active", stage: "qa" },
    ) as { changed: Record<string, { from: unknown; to: unknown }> };
    expect(diff.changed).toEqual({
      name: { from: "Old", to: "New" },
      stage: { from: "build", to: "qa" },
    });
    // unchanged fields are absent
    expect(diff.changed.status).toBeUndefined();
  });
});

describe("recordAudit", () => {
  it("writes an audit row with the computed diff and actor", async () => {
    const db = { auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) } };
    await recordAudit({
      entityType: AuditEntityType.client,
      entityId: "c1",
      action: AuditAction.create,
      clientId: "c1",
      actorId: "u1",
      after: { id: "c1", name: "Acme" },
      db: db as never,
    });
    const data = db.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      entityType: "client",
      entityId: "c1",
      action: "create",
      clientId: "c1",
      changedById: "u1",
    });
    expect(data.diff).toEqual({ after: { id: "c1", name: "Acme" } });
  });

  it("never throws into the caller if the audit write fails", async () => {
    const db = { auditLog: { create: vi.fn().mockRejectedValue(new Error("db down")) } };
    const log = { error: vi.fn() } as never;
    await expect(
      recordAudit({
        entityType: AuditEntityType.client,
        entityId: "c1",
        action: AuditAction.delete,
        clientId: "c1",
        actorId: "u1",
        before: { id: "c1" },
        db: db as never,
        log,
      }),
    ).resolves.toBeUndefined();
  });
});
