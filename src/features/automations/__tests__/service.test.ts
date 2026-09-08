import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutomationTrigger, AutomationActionType, ActivityType } from "@prisma/client";
import { createAutomation, updateAutomation, deleteAutomation } from "../service";

/**
 * Automation CRUD units with a mocked db. Focus: action-row mapping (incl. the
 * log_activity config shape), and update/delete 404s.
 */
function makeDb() {
  return {
    automation: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createAutomation", () => {
  it("maps actions to (type, config, sortOrder) rows", async () => {
    db.automation.create.mockResolvedValue({ id: "au1" });
    await createAutomation(
      {
        name: "Won → tag + log",
        trigger: AutomationTrigger.deal_won,
        active: true,
        actions: [
          { type: AutomationActionType.add_tag, tag: "Customer" },
          { type: AutomationActionType.log_activity, summary: "Deal won", activityType: ActivityType.note },
        ],
      } as never,
      { db: db as never },
    );
    const created = db.automation.create.mock.calls[0][0].data.actions.create;
    expect(created[0]).toEqual({ type: AutomationActionType.add_tag, config: { tag: "Customer" }, sortOrder: 0 });
    expect(created[1]).toEqual({ type: AutomationActionType.log_activity, config: { summary: "Deal won", type: ActivityType.note }, sortOrder: 1 });
  });

  it("drops empty conditions to undefined", async () => {
    db.automation.create.mockResolvedValue({ id: "au1" });
    await createAutomation(
      { name: "X", trigger: AutomationTrigger.client_created, active: true, conditions: {}, actions: [{ type: AutomationActionType.add_tag, tag: "T" }] } as never,
      { db: db as never },
    );
    expect(db.automation.create.mock.calls[0][0].data.conditions).toBeUndefined();
  });
});

describe("updateAutomation", () => {
  it("404s when missing", async () => {
    db.automation.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateAutomation("nope", { active: false }, { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("toggles active", async () => {
    db.automation.updateMany.mockResolvedValue({ count: 1 });
    db.automation.findUnique.mockResolvedValue({ id: "au1", active: false });
    await updateAutomation("au1", { active: false }, { db: db as never });
    expect(db.automation.updateMany.mock.calls[0][0].data.active).toBe(false);
  });
});

describe("deleteAutomation", () => {
  it("404s when nothing matched", async () => {
    db.automation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteAutomation("au1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });
});
