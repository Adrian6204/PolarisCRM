import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createContactSchema } from "@/features/contacts/schema";
import { createContact, listContacts } from "@/features/contacts/service";

/**
 * /api/clients/:id/contacts
 *   GET  — list a client's contacts (any authenticated user)
 *   POST — add a contact (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const contacts = await listContacts(String(params.id));
  return ok(contacts);
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createContactSchema);
    const contact = await createContact(String(params.id), input, { log });
    return ok(contact, { status: 201 });
  },
  { rateLimit: "write" },
);
