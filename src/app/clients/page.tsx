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
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        {writable && (
          <Link
            href="/clients/new"
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            New client
          </Link>
        )}
      </div>

      <ClientControls initialQ={query.q ?? ""} initialStatus={query.status ?? ""} />

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          No clients match. {writable && "Create one to get started."}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Industry</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-900/50"
              >
                <td className="py-2">
                  <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 text-gray-500">{c.industry ?? "—"}</td>
                <td className="py-2">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
