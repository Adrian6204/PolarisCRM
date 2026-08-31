import { notFound, redirect } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getClient } from "@/features/clients/service";
import { ApiError } from "@/lib/errors";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  if (!canWrite(user.role)) redirect("/clients");
  const { id } = await params;

  const client = await getClient(id).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {client.name}</h1>
      <ClientForm
        initial={{
          id: client.id,
          name: client.name,
          industry: client.industry,
          website: client.website,
          status: client.status,
        }}
      />
    </div>
  );
}
