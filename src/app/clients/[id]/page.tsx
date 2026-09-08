import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { ApiError } from "@/lib/errors";
import { StatusBadge } from "@/components/status-badge";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { listProjects } from "@/features/projects/service";
import { listDeals } from "@/features/deals/service";
import { getClientTimeline } from "@/features/timeline/service";
import { tagsForClient, listTags } from "@/features/tags/service";
import { getClientCustomFields } from "@/features/custom-fields/service";
import { listPipelines } from "@/features/pipelines/service";
import { prisma } from "@/lib/prisma";
import { serviceTypeLabel, stageLabel } from "@/features/projects/stages";
import { DeleteClientButton } from "./delete-button";
import { ContactsSection } from "./contacts-section";
import { TimelineSection } from "./timeline-section";
import { TagBar } from "./tag-bar";
import { CustomFieldsSection } from "./custom-fields-section";
import { DealsSection } from "./deals-section";

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
  const [{ items: projects }, timeline, { items: deals }, members, clientTags, allTags, customFields, pipelines] =
    await Promise.all([
      listProjects({ clientId: id, page: 1, pageSize: 100 }),
      getClientTimeline(id),
      listDeals({ clientId: id, page: 1, pageSize: 100 }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      tagsForClient(id),
      listTags(),
      getClientCustomFields(id),
      listPipelines(),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/clients" className="text-sm text-muted hover:underline">
            ← Clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
            <div>
              <dt className="inline font-medium text-muted">
                Industry:{" "}
              </dt>
              <dd className="inline">{client.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-muted">
                Website:{" "}
              </dt>
              <dd className="inline">
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="link hover:underline"
                  >
                    {client.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-1">
            <TagBar clientId={client.id} tags={clientTags} allTags={allTags} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${client.id}/reports`}
            className="btn btn-secondary !py-1.5"
          >
            Reports
          </Link>
          <Link
            href={`/clients/${client.id}/audit`}
            className="btn btn-secondary !py-1.5"
          >
            Audit
          </Link>
          {writable && (
            <>
              <Link
                href={`/clients/${client.id}/edit`}
                className="btn btn-secondary !py-1.5"
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
            <Link href="/projects/new" className="text-sm link hover:underline">
              + New project
            </Link>
          )}
        </div>
        {projects.length === 0 ? (
          <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
            No projects yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div className="flex flex-col">
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-sm text-muted">
                    {serviceTypeLabel(p.serviceType)} · {stageLabel(p.stage)}
                  </span>
                </div>
                <ProjectStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <DealsSection
        clientId={client.id}
        writable={writable}
        members={members}
        pipelines={pipelines.map((p) => ({
          id: p.id,
          name: p.name,
          stages: p.stages.map((s) => ({ id: s.id, name: s.name })),
        }))}
        deals={deals.map((d) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          pipelineId: d.pipelineId,
          stageId: d.stageId,
          stageName: d.stage.name,
          stageKind: d.stage.kind,
          owner: d.owner,
        }))}
      />

      <ContactsSection
        clientId={client.id}
        contacts={client.contacts}
        writable={writable}
      />

      <CustomFieldsSection clientId={client.id} fields={customFields} writable={writable} />

      <TimelineSection
        clientId={client.id}
        writable={writable}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        events={timeline}
      />
    </div>
  );
}
