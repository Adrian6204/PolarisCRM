import { redirect } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { ClientForm } from "../client-form";

/** New-client page. Write-gated: non-writers are bounced to the list. */
export default async function NewClientPage() {
  const user = await requirePageUser();
  if (!canWrite(user.role)) redirect("/clients");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
      <ClientForm />
    </div>
  );
}
