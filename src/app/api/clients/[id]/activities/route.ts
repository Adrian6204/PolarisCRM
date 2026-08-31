import { withApiRoute, ok, parseJson, parseQuery } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createActivitySchema,
  listActivitiesQuerySchema,
} from "@/features/activities/schema";
import { createActivity, listActivities } from "@/features/activities/service";

/**
 * /api/clients/:id/activities
 *   GET  — the client's activity feed (any authenticated user)
 *   POST — log an interaction (any authenticated user — logging calls/notes is
 *          a daily team action). created_by is taken from the session, never
 *          the body. Moderate `write` rate limit.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req, params }) => {
  await requireUser();
  const query = parseQuery(req, listActivitiesQuerySchema);
  const result = await listActivities(String(params.id), query);
  return ok(result);
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireUser();
    const input = await parseJson(req, createActivitySchema);
    const activity = await createActivity(String(params.id), input, user.id, { log });
    return ok(activity, { status: 201 });
  },
  { rateLimit: "write" },
);
