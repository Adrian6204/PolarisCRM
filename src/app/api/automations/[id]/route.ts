import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateAutomationSchema, updateAutomation, deleteAutomation } from "@/features/automations/service";

/**
 * /api/automations/:id
 *   PATCH  — rename / toggle active / edit conditions (admin).
 *   DELETE — remove the automation and its actions + runs (admin).
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, updateAutomationSchema);
    return ok(await updateAutomation(String(params.id), input, { log }));
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin);
    await deleteAutomation(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
