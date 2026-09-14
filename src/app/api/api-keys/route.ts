import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createApiKeySchema } from "@/features/api-keys/schema";
import { createApiKey, listApiKeys } from "@/features/api-keys/service";

/**
 * /api/api-keys, the current user's MCP access tokens.
 *   GET , list my keys (secrets never returned).
 *   POST, mint a new key; the raw secret is returned once in the response.
 * Keys inherit the caller's role, so any authenticated user may manage their own.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  const user = await requireUser();
  return ok(await listApiKeys(user.id));
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    const user = await requireUser();
    const input = await parseJson(req, createApiKeySchema);
    const created = await createApiKey(user.id, input, { log });
    return ok(created, { status: 201 });
  },
  { rateLimit: "write" },
);
