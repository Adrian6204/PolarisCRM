import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeliverableStatus, AppointmentStatus } from "@prisma/client";
import { createNotification, markRead, generateReminders } from "../service";

/**
 * Notification units with a mocked db. Focus: dedupe on create, owner-scoped
 * mark-read, and idempotent reminder generation (appointments + overdue tasks).
 */
function makeDb() {
  return {
    notification: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
    deliverable: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createNotification", () => {
  it("no-ops when the dedupeKey already exists", async () => {
    db.notification.findUnique.mockResolvedValue({ id: "n0" });
    const res = await createNotification({ userId: "u1", type: "x", title: "t", dedupeKey: "k" }, { db: db as never });
    expect(res).toBeNull();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("creates when the dedupeKey is new", async () => {
    db.notification.findUnique.mockResolvedValue(null);
    db.notification.create.mockResolvedValue({ id: "n1" });
    await createNotification({ userId: "u1", type: "x", title: "t", dedupeKey: "k" }, { db: db as never });
    expect(db.notification.create).toHaveBeenCalled();
  });
});

describe("markRead", () => {
  it("404s when the notification isn't the caller's", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    db.notification.findFirst.mockResolvedValue(null);
    await expect(markRead("n1", "u1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("scopes the update to the owner", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 1 });
    await markRead("n1", "u1", { db: db as never });
    expect(db.notification.updateMany.mock.calls[0][0].where).toMatchObject({ id: "n1", userId: "u1" });
  });
});

describe("generateReminders", () => {
  it("creates one reminder per upcoming appointment and overdue task", async () => {
    db.appointment.findMany.mockResolvedValue([
      { id: "a1", title: "Call", startAt: new Date(), ownerId: "u1" },
    ]);
    db.deliverable.findMany.mockResolvedValue([
      { id: "d1", title: "Ship", ownerId: "u2", projectId: "p1" },
    ]);
    db.notification.findUnique.mockResolvedValue(null); // nothing deduped yet
    db.notification.create.mockResolvedValue({ id: "n" });

    const { created } = await generateReminders({ db: db as never, now: new Date("2026-01-01T00:00:00Z") });
    expect(created).toBe(2);
    expect(db.notification.create.mock.calls[0][0].data.dedupeKey).toBe("appt:a1");
    expect(db.notification.create.mock.calls[1][0].data.dedupeKey).toBe("overdue:d1");
  });

  it("skips reminders that were already generated (dedupe)", async () => {
    db.appointment.findMany.mockResolvedValue([{ id: "a1", title: "Call", startAt: new Date(), ownerId: "u1" }]);
    db.notification.findUnique.mockResolvedValue({ id: "existing" });
    const { created } = await generateReminders({ db: db as never });
    expect(created).toBe(0);
    expect(db.notification.create).not.toHaveBeenCalled();
    // reference the enums so the import is exercised
    expect(AppointmentStatus.scheduled).toBeDefined();
    expect(DeliverableStatus.done).toBeDefined();
  });
});
