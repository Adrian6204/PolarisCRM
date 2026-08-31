import Link from "next/link";
import { notFound } from "next/navigation";
import type { AuditAction, AuditEntityType } from "@prisma/client";
import { requirePageUser } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { listClientAuditTrail } from "@/features/audit/service";
import { ApiError } from "@/lib/errors";

/**
 * Per-client audit trail (Phase 7): who changed what, when — across the client
 * and its projects/deliverables. Reads the denormalized clientId index.
 */
export const dynamic = "force-dynamic";

const ACTION_STYLE: Record<AuditAction, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const ENTITY_LABEL: Record<AuditEntityType, string> = {
  client: "Client",
  project: "Project",
  deliverable: "Deliverable",
};

/** Render the diff JSON compactly per action shape. */
function DiffView({ diff }: { diff: unknown }) {
  const d = (diff ?? {}) as {
    changed?: Record<string, { from: unknown; to: unknown }>;
    after?: Record<string, unknown>;
    before?: Record<string, unknown>;
  };

  if (d.changed) {
    const entries = Object.entries(d.changed);
    if (entries.length === 0) return <span className="text-gray-400">no field changes</span>;
    return (
      <ul className="flex flex-col gap-0.5">
        {entries.map(([field, { from, to }]) => (
          <li key={field} className="text-xs">
            <span className="font-medium">{field}</span>:{" "}
            <span className="text-gray-500 line-through">{fmt(from)}</span>{" "}
            <span aria-hidden>→</span> <span>{fmt(to)}</span>
          </li>
        ))}
      </ul>
    );
  }
  const snapshot = d.after ?? d.before;
  if (snapshot) {
    const name = (snapshot.name ?? snapshot.title) as string | undefined;
    return <span className="text-xs text-gray-500">{name ?? "—"}</span>;
  }
  return null;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "∅";
  return String(v);
}

export default async function ClientAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();
  const { id } = await params;

  const client = await getClient(id).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });
  const trail = await listClientAuditTrail(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/clients/${id}`} className="text-sm text-gray-500 hover:underline">
          ← {client.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Audit trail · {client.name}</h1>
      </div>

      {trail.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          No changes recorded yet.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-900 dark:border-gray-800">
          {trail.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[e.action]}`}>
                    {e.action}
                  </span>
                  <span className="text-sm font-medium">{ENTITY_LABEL[e.entityType]}</span>
                </div>
                <DiffView diff={e.diff} />
              </div>
              <div className="whitespace-nowrap text-right text-xs text-gray-400">
                <div>{e.changedBy ? (e.changedBy.name ?? e.changedBy.email) : "System"}</div>
                <time dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString()}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
