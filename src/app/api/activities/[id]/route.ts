import { Role } from "@prisma/client";
import { withApiRoute, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { deleteActivity } from "@/features/activities/service";

/**
 * /api/activities/:id
 *   DELETE — remove an erroneous log entry (admin / project lead). Activities
 *            are append-only and hard-deleted; there is no update.
 */
export const dynamic = "force-dynamic";

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteActivity(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
