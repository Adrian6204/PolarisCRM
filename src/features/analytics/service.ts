import { prisma } from "@/lib/prisma";
import {
  ProjectStatus,
  StageKind,
  DeliverableStatus,
  ClientStatus,
  ServiceType,
} from "@prisma/client";
import { getServiceLineStats } from "@/features/reports/service";
import { getPipelineStats, type StageStat } from "@/features/deals/service";
import { cacheGetOrSet } from "@/lib/cache";

/**
 * Analytics aggregations for the /analytics page. One entry point runs every
 * rollup in parallel. Everything is derived from live data via Prisma
 * groupBy/count/aggregate — no precomputed tables.
 */
export interface Analytics {
  kpis: {
    activeClients: number;
    activeProjects: number;
    openPipeline: number;
    overdue: number;
    winRate: number | null; // won / (won + lost), or null when no closed deals
    deliverablesDone: number;
    deliverablesTotal: number;
  };
  pipelineByStage: StageStat[];
  serviceLines: { serviceType: ServiceType; active: number }[];
  deliverablesByStatus: { status: DeliverableStatus; count: number }[];
  workload: { name: string; count: number }[];
  clientsByStatus: { status: ClientStatus; count: number }[];
}

/**
 * Cached analytics. The page fires 11 rollups; each DB round-trip is ~0.7s to a
 * remote region, so a short-TTL cache turns warm loads into a single Redis read.
 * A 45s TTL keeps figures fresh enough for an analytics view without wiring
 * per-entity invalidation (it tolerates minor staleness). Degrades to a live
 * compute when Redis is unconfigured.
 */
export async function getAnalytics(): Promise<Analytics> {
  return cacheGetOrSet("cache:analytics", 45, computeAnalytics);
}

async function computeAnalytics(): Promise<Analytics> {
  const now = new Date();

  const [
    activeClients,
    activeProjects,
    openAgg,
    overdue,
    won,
    lost,
    delivStatus,
    delivByOwner,
    clientStatus,
    users,
    serviceLines,
    pipelineByStage,
  ] = await Promise.all([
    prisma.client.count({ where: { status: ClientStatus.active, deletedAt: null } }),
    prisma.project.count({ where: { status: ProjectStatus.active, deletedAt: null } }),
    prisma.deal.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, stage: { kind: StageKind.open } },
    }),
    prisma.deliverable.count({
      where: { deletedAt: null, status: { not: DeliverableStatus.done }, dueDate: { lt: now } },
    }),
    prisma.deal.count({ where: { deletedAt: null, stage: { kind: StageKind.won } } }),
    prisma.deal.count({ where: { deletedAt: null, stage: { kind: StageKind.lost } } }),
    prisma.deliverable.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.deliverable.groupBy({
      by: ["ownerId"],
      where: { deletedAt: null, ownerId: { not: null } },
      _count: { _all: true },
    }),
    prisma.client.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    getServiceLineStats(),
    getPipelineStats(),
  ]);

  // Deliverable status counts in canonical order (0-filled).
  const DELIV_ORDER: DeliverableStatus[] = [
    DeliverableStatus.not_started,
    DeliverableStatus.in_progress,
    DeliverableStatus.review,
    DeliverableStatus.done,
  ];
  const deliverablesByStatus = DELIV_ORDER.map((status) => ({
    status,
    count: delivStatus.find((d) => d.status === status)?._count._all ?? 0,
  }));
  const deliverablesTotal = deliverablesByStatus.reduce((n, d) => n + d.count, 0);
  const deliverablesDone =
    deliverablesByStatus.find((d) => d.status === DeliverableStatus.done)?.count ?? 0;

  const userName = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? "Unknown";
  };
  const workload = delivByOwner
    .map((d) => ({ name: userName(d.ownerId), count: d._count._all }))
    .sort((a, b) => b.count - a.count);

  const CLIENT_ORDER: ClientStatus[] = [
    ClientStatus.active,
    ClientStatus.prospect,
    ClientStatus.past,
  ];
  const clientsByStatus = CLIENT_ORDER.map((status) => ({
    status,
    count: clientStatus.find((c) => c.status === status)?._count._all ?? 0,
  }));

  return {
    kpis: {
      activeClients,
      activeProjects,
      openPipeline: openAgg._sum.value ?? 0,
      overdue,
      winRate: won + lost > 0 ? won / (won + lost) : null,
      deliverablesDone,
      deliverablesTotal,
    },
    pipelineByStage,
    serviceLines,
    deliverablesByStatus,
    workload,
    clientsByStatus,
  };
}

// --- Performance report (P8) ----------------------------------------------

export interface PerformanceReport {
  from: string;
  to: string;
  sales: {
    created: number;
    won: number;
    lost: number;
    winRate: number | null;
    wonValue: number;
    avgCycleDays: number | null;
  };
  leaderboard: { name: string; wonCount: number; wonValue: number }[];
  activityByUser: { name: string; count: number }[];
}

/**
 * Time-bounded sales performance (P8). Outcomes (won/lost) are counted by the
 * period in which they *closed*; creations by createdAt. Adds a per-owner
 * leaderboard (won deals closed in range) and activity volume per user. Not
 * cached — the range is user-driven and the queries are cheap.
 */
export async function getPerformanceReport(range: { from: Date; to: Date }): Promise<PerformanceReport> {
  const { from, to } = range;
  const inRangeClosed = { deletedAt: null, closedAt: { gte: from, lt: to } };
  const wonWhere = { ...inRangeClosed, stage: { is: { kind: StageKind.won } } };
  const lostWhere = { ...inRangeClosed, stage: { is: { kind: StageKind.lost } } };

  const [created, won, lost, wonAgg, wonDeals, wonByOwner, activityByOwner, users] = await Promise.all([
    prisma.deal.count({ where: { deletedAt: null, createdAt: { gte: from, lt: to } } }),
    prisma.deal.count({ where: wonWhere }),
    prisma.deal.count({ where: lostWhere }),
    prisma.deal.aggregate({ _sum: { value: true }, where: wonWhere }),
    prisma.deal.findMany({ where: wonWhere, select: { createdAt: true, closedAt: true } }),
    prisma.deal.groupBy({ by: ["ownerId"], where: wonWhere, _count: { _all: true }, _sum: { value: true } }),
    prisma.activity.groupBy({ by: ["createdById"], where: { createdAt: { gte: from, lt: to } }, _count: { _all: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);

  const name = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? "Unknown";
  };

  const cycles = wonDeals
    .filter((d) => d.closedAt)
    .map((d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / 86_400_000);
  const avgCycleDays = cycles.length ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10 : null;

  const leaderboard = wonByOwner
    .map((g) => ({ name: name(g.ownerId), wonCount: g._count._all, wonValue: g._sum.value ?? 0 }))
    .sort((a, b) => b.wonValue - a.wonValue);

  const activityByUser = activityByOwner
    .map((g) => ({ name: name(g.createdById), count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    sales: {
      created,
      won,
      lost,
      winRate: won + lost > 0 ? won / (won + lost) : null,
      wonValue: wonAgg._sum.value ?? 0,
      avgCycleDays,
    },
    leaderboard,
    activityByUser,
  };
}
