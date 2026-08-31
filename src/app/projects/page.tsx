import Link from "next/link";
import { z } from "zod";
import { ServiceType } from "@prisma/client";
import { requirePageUser, canWrite } from "@/lib/session";
import { listProjects, type ProjectWithClient } from "@/features/projects/service";
import {
  boardStagesFor,
  stageLabel,
  serviceTypeLabel,
} from "@/features/projects/stages";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { ServiceTabs } from "./service-tabs";
import { StageSelect } from "./stage-select";

/**
 * Project board (Phase 2): a per-service-type Kanban. Columns are the stage set
 * for the selected service type; each card shows the client and lets a writer
 * change the stage inline. Service type is selected via ?serviceType=.
 */
export const dynamic = "force-dynamic";

const serviceParam = z.nativeEnum(ServiceType).catch(ServiceType.web_dev);

export default async function ProjectsBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const { serviceType: rawService } = await searchParams;
  const serviceType = serviceParam.parse(rawService);
  const writable = canWrite(user.role);

  // Pull all non-deleted projects for this service type (board scope is small).
  const { items } = await listProjects(
    { serviceType, page: 1, pageSize: 100 },
    { withClient: true },
  );
  const projects = items as ProjectWithClient[];

  const stages = boardStagesFor(serviceType);
  const byStage = new Map<string, ProjectWithClient[]>();
  for (const s of stages) byStage.set(s, []);
  for (const p of projects) {
    if (!byStage.has(p.stage)) byStage.set(p.stage, []);
    byStage.get(p.stage)!.push(p);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-gray-500">
            {projects.length} {serviceTypeLabel(serviceType)} engagement
            {projects.length === 1 ? "" : "s"}
          </p>
        </div>
        {writable && (
          <Link
            href="/projects/new"
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            New project
          </Link>
        )}
      </div>

      <ServiceTabs active={serviceType} />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...byStage.entries()].map(([stage, list]) => (
          <div key={stage} className="flex w-64 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">{stageLabel(stage)}</h2>
              <span className="text-xs text-gray-400">{list.length}</span>
            </div>
            <div className="flex min-h-16 flex-col gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <Link
                    href={`/clients/${p.clientId}`}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    {p.client.name}
                  </Link>
                  <StageSelect
                    projectId={p.id}
                    serviceType={p.serviceType}
                    engagementType={p.engagementType}
                    stage={p.stage}
                    disabled={!writable}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
