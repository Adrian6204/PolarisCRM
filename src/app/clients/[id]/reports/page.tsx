import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { listProjects } from "@/features/projects/service";
import { listClientReports } from "@/features/reports/service";
import { ApiError } from "@/lib/errors";
import { ReportsManager } from "./reports-manager";

/** Per-client reporting page (Phase 6). Report reads are cached (Upstash). */
export const dynamic = "force-dynamic";

export default async function ClientReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const client = await getClient(id).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });

  const [{ items: projects }, reports] = await Promise.all([
    listProjects({ clientId: id, page: 1, pageSize: 100 }),
    listClientReports(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/clients/${id}`} className="text-sm text-gray-500 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reports · {client.name}</h1>
      </div>

      <ReportsManager
        writable={canWrite(user.role)}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        reports={reports.map((r) => ({
          id: r.id,
          period: r.period,
          notes: r.notes,
          metrics: r.metrics as Record<string, string | number | boolean>,
          project: {
            id: r.project.id,
            name: r.project.name,
            serviceType: r.project.serviceType,
          },
        }))}
      />
    </div>
  );
}
