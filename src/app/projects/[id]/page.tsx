import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getProject } from "@/features/projects/service";
import { ApiError } from "@/lib/errors";
import { serviceTypeLabel } from "@/features/projects/stages";
import { ProjectEditor } from "./project-editor";

/** Project detail (Phase 2), linked to its client. */
export const dynamic = "force-dynamic";

/** Format a nullable Date as a YYYY-MM-DD string for date inputs. */
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const project = await getProject(id, { withClient: true }).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });
  const writable = canWrite(user.role);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/projects" className="text-sm text-gray-500 hover:underline">
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-gray-500">
          <div>
            <dt className="inline font-medium text-gray-600 dark:text-gray-400">Client: </dt>
            <dd className="inline">
              <Link href={`/clients/${project.clientId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                {project.client.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-600 dark:text-gray-400">Service: </dt>
            <dd className="inline">{serviceTypeLabel(project.serviceType)}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-600 dark:text-gray-400">Engagement: </dt>
            <dd className="inline">{project.engagementType === "retainer" ? "Retainer" : "One-off"}</dd>
          </div>
        </dl>
      </div>

      <ProjectEditor
        writable={writable}
        project={{
          id: project.id,
          name: project.name,
          serviceType: project.serviceType,
          engagementType: project.engagementType,
          stage: project.stage,
          status: project.status,
          startDate: dateInput(project.startDate),
          endDate: dateInput(project.endDate),
          retainerRenewalDate: dateInput(project.retainerRenewalDate),
        }}
      />
    </div>
  );
}
