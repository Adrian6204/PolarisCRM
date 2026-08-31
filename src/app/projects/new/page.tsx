import { redirect } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { listClients } from "@/features/clients/service";
import { ProjectForm } from "../project-form";

/** New-project page. Loads active clients for the picker; write-gated. */
export default async function NewProjectPage() {
  const user = await requirePageUser();
  if (!canWrite(user.role)) redirect("/projects");

  // Only non-deleted clients are selectable (list is small for now).
  const { items } = await listClients({ page: 1, pageSize: 100 });
  const clients = items.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
      <ProjectForm clients={clients} />
    </div>
  );
}
