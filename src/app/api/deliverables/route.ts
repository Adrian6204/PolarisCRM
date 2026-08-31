import { withApiRoute, ok, parseQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listDeliverablesQuerySchema } from "@/features/deliverables/schema";
import { listDeliverables } from "@/features/deliverables/service";

/**
 * /api/deliverables
 *   GET — global deliverable list with filters (ownerId, status, projectId, q).
 *         Backs the "my tasks" / cross-project task view. Any authenticated
 *         user; reads not rate-limited. Creation is nested under a project.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const query = parseQuery(req, listDeliverablesQuerySchema);
  const result = await listDeliverables(query);
  return ok(result);
});
