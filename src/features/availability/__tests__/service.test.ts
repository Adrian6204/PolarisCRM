import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSlots, setUserAvailability } from "../service";

/**
 * Availability units with a mocked db. Focus: slot generation within windows,
 * exclusion of busy + past slots, and the replace-all set semantics.
 */
function makeDb() {
  const db = {
    availabilityRule: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    appointment: { findMany: vi.fn() },
  };
  return db;
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

// 2026-01-05 is a Monday (weekday 1) in local time.
const DATE = "2026-01-05";
const min = (h: number) => h * 60;

describe("computeSlots", () => {
  it("slices a window into fixed steps, excluding busy and past", async () => {
    db.availabilityRule.findMany.mockResolvedValue([{ userId: "u1", weekday: 1, startMin: min(9), endMin: min(12) }]);
    // Busy 10:00–11:00 local blocks that one slot.
    db.appointment.findMany.mockResolvedValue([
      { startAt: new Date(2026, 0, 5, 10, 0, 0), endAt: new Date(2026, 0, 5, 11, 0, 0) },
    ]);
    // "now" is well before the date, so nothing is filtered as past.
    const slots = await computeSlots("u1", DATE, 60, { db: db as never, now: new Date(2026, 0, 1) });
    const hours = slots.map((s) => new Date(s.startAt).getHours());
    expect(hours).toEqual([9, 11]); // 10:00 excluded as busy
  });

  it("drops slots that start in the past", async () => {
    db.availabilityRule.findMany.mockResolvedValue([{ userId: "u1", weekday: 1, startMin: min(9), endMin: min(11) }]);
    db.appointment.findMany.mockResolvedValue([]);
    // "now" is 09:30 that day → the 09:00 slot is past, 10:00 remains.
    const slots = await computeSlots("u1", DATE, 60, { db: db as never, now: new Date(2026, 0, 5, 9, 30) });
    expect(slots.map((s) => new Date(s.startAt).getHours())).toEqual([10]);
  });

  it("returns nothing when the weekday has no rules", async () => {
    db.availabilityRule.findMany.mockResolvedValue([]);
    expect(await computeSlots("u1", DATE, 30, { db: db as never, now: new Date(2026, 0, 1) })).toEqual([]);
  });
});

describe("setUserAvailability", () => {
  it("replaces all rules for the user", async () => {
    db.availabilityRule.deleteMany.mockResolvedValue({ count: 2 });
    db.availabilityRule.createMany.mockResolvedValue({ count: 1 });
    db.availabilityRule.findMany.mockResolvedValue([]);
    await setUserAvailability("u1", { rules: [{ weekday: 1, startMin: 540, endMin: 1020 }] }, { db: db as never });
    expect(db.availabilityRule.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(db.availabilityRule.createMany.mock.calls[0][0].data).toEqual([
      { userId: "u1", weekday: 1, startMin: 540, endMin: 1020 },
    ]);
  });
});
