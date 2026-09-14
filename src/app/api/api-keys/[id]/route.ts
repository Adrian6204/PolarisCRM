import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { revokeApiKey } from "@/features/api-keys/service";

/** /api/api-keys/:id, revoke one of my keys (owner-scoped in the service). */
export const dynamic = "force-dynamic";

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    const user = await requireUser();
    await revokeApiKey(user.id, String(params.id), { log });
    return ok({ id: params.id, revoked: true });
  },
  { rateLimit: "write" },
);
