import { withApiRoute, ok, parseQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listDealsQuerySchema } from "@/features/deals/schema";
import { listDeals } from "@/features/deals/service";

/**
 * /api/deals
 *   GET — global deal list with filters (stage, ownerId, clientId, q). Backs
 *         the pipeline board. Any authenticated user; creation is nested under
 *         a client.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const query = parseQuery(req, listDealsQuerySchema);
  return ok(await listDeals(query));
});
