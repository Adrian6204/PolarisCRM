import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppointmentStatus } from "@prisma/client";
import { createAppointment, updateAppointment, deleteAppointment, listAppointments } from "../service";

/**
 * Appointment service units with a mocked db. Focus: the host double-booking
 * guard (create + reschedule), cancelled appointments skipping the guard, the
 * end>start check, window filtering, and 404s.
 */
function makeDb() {
  return {
    appointment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

const T = (h: number) => new Date(`2026-03-02T${String(h).padStart(2, "0")}:00:00Z`);

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createAppointment", () => {
  const base = { title: "Call", ownerId: "u1", startAt: T(9), endAt: T(10) };

  it("creates when the host is free", async () => {
    db.appointment.findFirst.mockResolvedValue(null);
    db.appointment.create.mockResolvedValue({ id: "a1" });
    await createAppointment(base as never, { db: db as never });
    expect(db.appointment.create).toHaveBeenCalled();
    // Overlap query uses the half-open interval test.
    const w = db.appointment.findFirst.mock.calls[0][0].where;
    expect(w.ownerId).toBe("u1");
    expect(w.startAt.lt).toEqual(T(10));
    expect(w.endAt.gt).toEqual(T(9));
  });

  it("rejects a double-booking", async () => {
    db.appointment.findFirst.mockResolvedValue({ id: "clash" });
    await expect(createAppointment(base as never, { db: db as never })).rejects.toMatchObject({ code: "conflict" });
    expect(db.appointment.create).not.toHaveBeenCalled();
  });
});

describe("updateAppointment", () => {
  it("404s when missing", async () => {
    db.appointment.findUnique.mockResolvedValue(null);
    await expect(updateAppointment("x", { title: "y" }, { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a reschedule that overlaps another appointment (excluding self)", async () => {
    db.appointment.findUnique.mockResolvedValue({ id: "a1", ownerId: "u1", startAt: T(9), endAt: T(10), status: AppointmentStatus.scheduled });
    db.appointment.findFirst.mockResolvedValue({ id: "other" });
    await expect(updateAppointment("a1", { startAt: T(11), endAt: T(12) }, { db: db as never })).rejects.toMatchObject({ code: "conflict" });
    expect(db.appointment.findFirst.mock.calls[0][0].where.NOT).toEqual({ id: "a1" });
  });

  it("skips the overlap check when cancelling", async () => {
    db.appointment.findUnique.mockResolvedValue({ id: "a1", ownerId: "u1", startAt: T(9), endAt: T(10), status: AppointmentStatus.scheduled });
    db.appointment.update.mockResolvedValue({ id: "a1" });
    await updateAppointment("a1", { status: AppointmentStatus.cancelled }, { db: db as never });
    expect(db.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an inverted time range", async () => {
    db.appointment.findUnique.mockResolvedValue({ id: "a1", ownerId: "u1", startAt: T(9), endAt: T(10), status: AppointmentStatus.scheduled });
    await expect(updateAppointment("a1", { startAt: T(12), endAt: T(11) }, { db: db as never })).rejects.toMatchObject({ code: "bad_request" });
  });
});

describe("listAppointments", () => {
  it("windows by start time [from, to)", async () => {
    db.appointment.findMany.mockResolvedValue([]);
    await listAppointments({ from: T(0), to: T(23), ownerId: "u1" }, { db: db as never });
    const w = db.appointment.findMany.mock.calls[0][0].where;
    expect(w.startAt).toEqual({ gte: T(0), lt: T(23) });
    expect(w.ownerId).toBe("u1");
  });
});

describe("deleteAppointment", () => {
  it("404s when nothing matched", async () => {
    db.appointment.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteAppointment("a1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });
});
