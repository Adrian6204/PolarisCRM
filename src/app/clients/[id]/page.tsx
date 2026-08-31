import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { ApiError } from "@/lib/errors";
import { StatusBadge } from "@/components/status-badge";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { listProjects } from "@/features/projects/service";
import { listActivities } from "@/features/activities/service";
import { serviceTypeLabel, stageLabel } from "@/features/projects/stages";
import { DeleteClientButton } from "./delete-button";
import { ContactsSection } from "./contacts-section";
import { ActivitySection } from "./activity-section";

/** Client detail view with contacts + projects (Phase 1–2). */
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const client = await getClient(id, { withContacts: true }).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });
  const writable = canWrite(user.role);
  const [{ items: projects }, { items: activities }] = await Promise.all([
    listProjects({ clientId: id, page: 1, pageSize: 100 }),
    listActivities(id, { page: 1, pageSize: 50 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/clients" className="text-sm text-gray-500 hover:underline">
            ← Clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-1 text-sm text-gray-500">
            <div>
              <dt className="inline font-medium text-gray-600 dark:text-gray-400">
                Industry:{" "}
              </dt>
              <dd className="inline">{client.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-gray-600 dark:text-gray-400">
                Website:{" "}
              </dt>
              <dd className="inline">
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {client.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${client.id}/reports`}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Reports
          </Link>
          {writable && (
            <>
              <Link
                href={`/clients/${client.id}/edit`}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                Edit
              </Link>
              <DeleteClientButton clientId={client.id} clientName={client.name} />
            </>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          {writable && (
            <Link href="/projects/new" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              + New project
            </Link>
          )}
        </div>
        {projects.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
            No projects yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-900">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col">
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-sm text-gray-500">
                    {serviceTypeLabel(p.serviceType)} · {stageLabel(p.stage)}
                  </span>
                </div>
                <ProjectStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContactsSection
        clientId={client.id}
        contacts={client.contacts}
        writable={writable}
      />

      <ActivitySection
        clientId={client.id}
        writable={writable}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        activities={activities.map((a) => ({
          id: a.id,
          type: a.type,
          summary: a.summary,
          createdAt: a.createdAt.toISOString(),
          createdBy: a.createdBy,
          project: a.project,
        }))}
      />
    </div>
  );
}
