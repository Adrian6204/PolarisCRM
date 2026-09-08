import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { unassignTag } from "@/features/tags/service";

/**
 * /api/clients/:id/tags/:tagId
 *   DELETE — remove a tag from the client (any authenticated user).
 */
export const dynamic = "force-dynamic";

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireUser();
    await unassignTag(String(params.id), String(params.tagId), { log });
    return ok({ clientId: params.id, tagId: params.tagId, removed: true });
  },
  { rateLimit: "write" },
);
