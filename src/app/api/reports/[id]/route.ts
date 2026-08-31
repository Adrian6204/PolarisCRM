import { Role } from "@prisma/client";
import { withApiRoute, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { deleteReport } from "@/features/reports/service";

/**
 * /api/reports/:id
 *   DELETE — remove a report entry (admin / project lead). Invalidates the
 *            owning client's cached report set.
 */
export const dynamic = "force-dynamic";

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteReport(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
