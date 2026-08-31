import { prisma } from "@/lib/prisma";
import {
  ProjectStatus,
  DealStage,
  DeliverableStatus,
  ClientStatus,
  ServiceType,
} from "@prisma/client";
import { getServiceLineStats } from "@/features/reports/service";
import { getPipelineStats } from "@/features/deals/service";

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
  pipelineByStage: { stage: DealStage; value: number; count: number }[];
  serviceLines: { serviceType: ServiceType; active: number }[];
  deliverablesByStatus: { status: DeliverableStatus; count: number }[];
  workload: { name: string; count: number }[];
  clientsByStatus: { status: ClientStatus; count: number }[];
}

export async function getAnalytics(): Promise<Analytics> {
  const now = new Date();

  const [
    activeClients,
    activeProjects,
    openAgg,
    overdue,
    dealStageCounts,
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
      where: { deletedAt: null, stage: { in: [DealStage.lead, DealStage.proposal] } },
    }),
    prisma.deliverable.count({
      where: { deletedAt: null, status: { not: DeliverableStatus.done }, dueDate: { lt: now } },
    }),
    prisma.deal.groupBy({ by: ["stage"], where: { deletedAt: null }, _count: { _all: true } }),
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

  const dealCount = (s: DealStage) =>
    dealStageCounts.find((d) => d.stage === s)?._count._all ?? 0;
  const won = dealCount(DealStage.won);
  const lost = dealCount(DealStage.lost);

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
