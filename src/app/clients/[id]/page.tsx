import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { ApiError } from "@/lib/errors";
import { StatusBadge } from "@/components/status-badge";
import { DeleteClientButton } from "./delete-button";
import { ContactsSection } from "./contacts-section";

/** Client detail view with contacts (Phase 1). */
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

        {writable && (
          <div className="flex items-center gap-3">
            <Link
              href={`/clients/${client.id}/edit`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Edit
            </Link>
            <DeleteClientButton clientId={client.id} clientName={client.name} />
          </div>
        )}
      </div>

      <ContactsSection
        clientId={client.id}
        contacts={client.contacts}
        writable={writable}
      />
    </div>
  );
}
