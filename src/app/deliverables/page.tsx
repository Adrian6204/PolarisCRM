import { requirePageUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listDeliverables } from "@/features/deliverables/service";
import { listDeliverablesQuerySchema } from "@/features/deliverables/schema";
import { TaskFilters } from "./task-filters";
import { TaskRow } from "./task-row";

/**
 * Global task list (Phase 3) — cross-project deliverables with status/owner
 * filters and inline status changes. The "Assigned to me" filter makes this a
 * quick daily worklist. Sorted by due date (soonest first).
 */
export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const raw = await searchParams;
  const query = listDeliverablesQuerySchema.parse(raw);

  const [{ items, total }, members] = await Promise.all([
    listDeliverables({ ...query, pageSize: 200 }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliverables</h1>
        <p className="text-sm text-muted">{total} across all projects</p>
      </div>

      <TaskFilters members={members} currentUserId={user.id} />

      {items.length === 0 ? (
        <p className="empty">No deliverables match.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Title</th>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Owner</th>
                <th className="px-4 py-2.5 font-semibold">Due</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody data-stagger>
              {items.map((d) => (
                <TaskRow
                  key={d.id}
                  task={{
                    id: d.id,
                    title: d.title,
                    status: d.status,
                    dueDate: dateInput(d.dueDate),
                    owner: d.owner,
                    project: d.project,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
