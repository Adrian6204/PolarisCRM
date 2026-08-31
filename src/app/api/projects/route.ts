import { withApiRoute, ok, parseQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listProjectsQuerySchema } from "@/features/projects/schema";
import { listProjects } from "@/features/projects/service";

/**
 * /api/projects
 *   GET — global project list with filters (serviceType, status, clientId, q).
 *         Backs the per-service board/list view. Any authenticated user; reads
 *         are not rate-limited (internal). Creation is nested under a client
 *         (POST /api/clients/:id/projects).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req, log }) => {
  await requireUser();
  const query = parseQuery(req, listProjectsQuerySchema);
  const result = await listProjects(query, { withClient: true });
  log.debug({ total: result.total }, "listed projects");
  return ok(result);
});
