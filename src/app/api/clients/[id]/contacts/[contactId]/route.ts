import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateContactSchema } from "@/features/contacts/schema";
import { deleteContact, updateContact } from "@/features/contacts/service";

/**
 * /api/clients/:id/contacts/:contactId
 *   PATCH  — update a contact (admin / project lead)
 *   DELETE — remove a contact, hard delete (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, updateContactSchema);
    const contact = await updateContact(
      String(params.id),
      String(params.contactId),
      input,
      { log },
    );
    return ok(contact);
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteContact(String(params.id), String(params.contactId), { log });
    return ok({ id: params.contactId, deleted: true });
  },
  { rateLimit: "write" },
);
