import type { Prisma, PrismaClient } from "@prisma/client";
import { EngagementType, ProjectStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/**
 * Retainer renewal queries (Phase 5). Shared by the scheduled scan job and the
 * dashboard widget so both use the exact same definition of "upcoming renewal":
 * an active, non-deleted retainer engagement whose renewal date falls between
 * today and `withinDays` from now.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export type UpcomingRenewal = Prisma.ProjectGetPayload<{
  include: { client: { select: { id: true; name: true } } };
}> & { daysUntil: number };

/** Whole days from `now` until `date` (0 = due today, negative = overdue). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY);
}

export async function getUpcomingRenewals(
  withinDays = 30,
  opts: { db?: Db; now?: Date } = {},
): Promise<UpcomingRenewal[]> {
  const db = opts.db ?? defaultPrisma;
  const now = opts.now ?? new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + withinDays);

  const projects = await db.project.findMany({
    where: {
      deletedAt: null,
      engagementType: EngagementType.retainer,
      status: ProjectStatus.active,
      retainerRenewalDate: { not: null, gte: now, lte: until },
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { retainerRenewalDate: "asc" }, // soonest first
  });

  return projects.map((p) => ({
    ...p,
    daysUntil: daysUntil(p.retainerRenewalDate as Date, now),
  }));
}
