import type { Prisma, PrismaClient } from "@prisma/client";
import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Logger } from "@/lib/logger";
import { runInTx } from "@/lib/tx";

/**
 * Availability + slot generation (G3). A host's weekly availability is a set of
 * windows (weekday + minute range). Bookable slots for a given day are the
 * windows sliced into fixed-duration steps, minus the host's existing
 * non-cancelled appointments and any time already past.
 *
 * Timezone: times are handled in the server's local timezone (single-org
 * assumption). Per-user timezones would be a future enhancement.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const ruleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startMin: z.coerce.number().int().min(0).max(1440),
    endMin: z.coerce.number().int().min(0).max(1440),
  })
  .refine((r) => r.endMin > r.startMin, { message: "endMin must be after startMin", path: ["endMin"] });

export const setAvailabilitySchema = z.object({ rules: z.array(ruleSchema).max(50) });
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;

export async function getUserAvailability(userId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.availabilityRule.findMany({
    where: { userId },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
}

/** Replace a user's entire availability rule set (delete-all then create). */
export async function setUserAvailability(
  userId: string,
  input: SetAvailabilityInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  await runInTx(opts.db, async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { userId } });
    if (input.rules.length > 0) {
      await tx.availabilityRule.createMany({
        data: input.rules.map((r) => ({ userId, weekday: r.weekday, startMin: r.startMin, endMin: r.endMin })),
      });
    }
  });
  opts.log?.debug({ userId, count: input.rules.length }, "db write: availability set");
  return getUserAvailability(userId, { db: opts.db });
}

export interface Slot {
  startAt: string; // ISO
  endAt: string; // ISO
}

/** Build a Date at the given local wall-clock minute offset into `date`. */
function atMinute(year: number, month: number, day: number, minute: number): Date {
  const midnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  return new Date(midnight.getTime() + minute * 60_000);
}

/**
 * Bookable slots for `userId` on `date` (YYYY-MM-DD) at `durationMin` length.
 * Steps through each availability window for that weekday, dropping slots that
 * are in the past or overlap an existing non-cancelled appointment.
 */
export async function computeSlots(
  userId: string,
  date: string,
  durationMin: number,
  opts: { db?: Db; now?: Date } = {},
): Promise<Slot[]> {
  const db = opts.db ?? defaultPrisma;
  const now = opts.now ?? new Date();
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d || durationMin <= 0) return [];

  const weekday = new Date(y, m - 1, d).getDay();
  const rules = await db.availabilityRule.findMany({ where: { userId, weekday } });
  if (rules.length === 0) return [];

  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const busy = await db.appointment.findMany({
    where: {
      ownerId: userId,
      status: { not: AppointmentStatus.cancelled },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });

  const slots: Slot[] = [];
  for (const rule of rules) {
    for (let start = rule.startMin; start + durationMin <= rule.endMin; start += durationMin) {
      const startAt = atMinute(y, m, d, start);
      const endAt = atMinute(y, m, d, start + durationMin);
      if (startAt < now) continue;
      const overlaps = busy.some((b) => b.startAt < endAt && b.endAt > startAt);
      if (overlaps) continue;
      slots.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    }
  }
  return slots.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
}
