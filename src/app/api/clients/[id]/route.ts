import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { updateClientSchema } from "@/features/clients/schema";
import {
  getClient,
  softDeleteClient,
  updateClient,
} from "@/features/clients/service";

/**
 * /api/clients/:id
 *   GET    — client detail with contacts (any authenticated user)
 *   PATCH  — update (admin / project lead)
 *   DELETE — soft delete (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const client = await getClient(String(params.id), { withContacts: true });
  return ok(client);
});

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, updateClientSchema);
    const client = await updateClient(String(params.id), input, { log, actorId: user.id });
    return ok(client);
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    await softDeleteClient(String(params.id), { log, actorId: user.id });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
