import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutomationTrigger, AutomationActionType } from "@prisma/client";
import { runAutomations } from "../engine";

/**
 * Engine units with a mocked db. Focus: condition matching (skip vs run),
 * per-action side effects, {{token}} templating, and run-log recording
 * (success vs error) without aborting other rules.
 */
function makeDb() {
  return {
    automation: { findMany: vi.fn() },
    automationRun: { create: vi.fn() },
    tag: { findFirst: vi.fn(), create: vi.fn() },
    clientTag: { upsert: vi.fn() },
    note: { create: vi.fn() },
    activity: { create: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { create: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.automationRun.create.mockResolvedValue({ id: "run1" });
});

function rule(over: Partial<{ id: string; conditions: unknown; actions: unknown[] }> = {}) {
  return { id: "au1", conditions: null, actions: [], ...over };
}

describe("condition matching", () => {
  it("skips a rule whose conditions don't match (no run recorded)", async () => {
    db.automation.findMany.mockResolvedValue([
      rule({ conditions: { stageKind: "won" }, actions: [{ type: AutomationActionType.add_tag, config: { tag: "X" } }] }),
    ]);
    await runAutomations(
      { trigger: AutomationTrigger.deal_stage_changed, clientId: "cl1", context: { stageKind: "lost" } },
      { db: db as never },
    );
    expect(db.clientTag.upsert).not.toHaveBeenCalled();
    expect(db.automationRun.create).not.toHaveBeenCalled();
  });

  it("runs when conditions match", async () => {
    db.tag.findFirst.mockResolvedValue({ id: "t1" });
    db.automation.findMany.mockResolvedValue([
      rule({ conditions: { stageKind: "won" }, actions: [{ type: AutomationActionType.add_tag, config: { tag: "VIP" } }] }),
    ]);
    await runAutomations(
      { trigger: AutomationTrigger.deal_won, clientId: "cl1", context: { stageKind: "won" } },
      { db: db as never },
    );
    expect(db.clientTag.upsert).toHaveBeenCalled();
    expect(db.automationRun.create.mock.calls[0][0].data.status).toBe("success");
  });
});

describe("actions", () => {
  it("add_tag creates the tag when missing then links it", async () => {
    db.tag.findFirst.mockResolvedValue(null);
    db.tag.create.mockResolvedValue({ id: "t9" });
    db.automation.findMany.mockResolvedValue([rule({ actions: [{ type: AutomationActionType.add_tag, config: { tag: "New" } }] })]);
    await runAutomations({ trigger: AutomationTrigger.client_created, clientId: "cl1" }, { db: db as never });
    expect(db.tag.create).toHaveBeenCalledWith({ data: { name: "New", color: "slate" } });
    expect(db.clientTag.upsert.mock.calls[0][0].where.clientId_tagId).toEqual({ clientId: "cl1", tagId: "t9" });
  });

  it("create_note templates {{tokens}} from context", async () => {
    db.note.create.mockResolvedValue({ id: "n1" });
    db.automation.findMany.mockResolvedValue([
      rule({ actions: [{ type: AutomationActionType.create_note, config: { body: "Welcome {{clientName}}!" } }] }),
    ]);
    await runAutomations(
      { trigger: AutomationTrigger.client_created, clientId: "cl1", context: { clientName: "Acme" } },
      { db: db as never },
    );
    expect(db.note.create.mock.calls[0][0].data.body).toBe("Welcome Acme!");
  });

  it("notify creates a notification for each active admin with templated text", async () => {
    db.user.findMany.mockResolvedValue([{ id: "adm1" }, { id: "adm2" }]);
    db.notification.create.mockResolvedValue({ id: "n1" });
    db.automation.findMany.mockResolvedValue([
      rule({ actions: [{ type: AutomationActionType.notify, config: { title: "Won: {{dealTitle}}", body: "by {{clientName}}" } }] }),
    ]);
    await runAutomations(
      { trigger: AutomationTrigger.deal_won, clientId: "cl1", context: { dealTitle: "Big", clientName: "Acme" } },
      { db: db as never },
    );
    expect(db.notification.create).toHaveBeenCalledTimes(2);
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({ userId: "adm1", title: "Won: Big", body: "by Acme", href: "/clients/cl1" });
    expect(db.automationRun.create.mock.calls[0][0].data.status).toBe("success");
  });

  it("records an error run when an action has no client to target", async () => {
    db.automation.findMany.mockResolvedValue([rule({ actions: [{ type: AutomationActionType.create_note, config: { body: "hi" } }] })]);
    await runAutomations({ trigger: AutomationTrigger.appointment_scheduled, clientId: null }, { db: db as never });
    expect(db.note.create).not.toHaveBeenCalled();
    expect(db.automationRun.create.mock.calls[0][0].data.status).toBe("error");
  });
});
