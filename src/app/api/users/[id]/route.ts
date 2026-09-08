import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateUserSchema, updateUser } from "@/features/users/service";

/**
 * /api/users/:id
 *   PATCH — rename / assign role / activate-deactivate (admin). Guardrails
 *           block self role/status changes and removing the last active admin.
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    const admin = await requireRole(Role.admin);
    const input = await parseJson(req, updateUserSchema);
    return ok(await updateUser(String(params.id), input, admin.id, { log }));
  },
  { rateLimit: "write" },
);
