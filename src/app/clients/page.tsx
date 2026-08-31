import Link from "next/link";
import { requirePageUser, canWrite } from "@/lib/session";
import { listClients } from "@/features/clients/service";
import { listClientsQuerySchema } from "@/features/clients/schema";
import { ClientControls } from "./client-controls";
import { StatusBadge } from "@/components/status-badge";

/**
 * Client list view (Phase 1). Reads happen server-side via the service (no
 * extra HTTP hop). Search/status filters live in the URL so the view is
 * shareable and back-button friendly.
 */
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const raw = await searchParams;
  // Reuse the same schema the API uses, so UI and API validation never drift.
  const query = listClientsQuerySchema.parse(raw);
  const { items, total } = await listClients(query);
  const writable = canWrite(user.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        {writable && (
          <Link
            href="/clients/new"
            className="btn btn-primary"
          >
            New client
          </Link>
        )}
      </div>

      <ClientControls initialQ={query.q ?? ""} initialStatus={query.status ?? ""} />

      {items.length === 0 ? (
        <p className="empty">
          No clients match. {writable && "Create one to get started."}
        </p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Industry</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody data-stagger>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.industry ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
