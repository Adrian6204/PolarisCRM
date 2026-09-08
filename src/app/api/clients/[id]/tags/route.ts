import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assignTagSchema, assignTag, tagsForClient } from "@/features/tags/service";

/**
 * /api/clients/:id/tags
 *   GET  — tags on this client
 *   POST — assign a tag (by id, or create-and-assign by name). Any authed user.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await tagsForClient(String(params.id)));
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireUser();
    const input = await parseJson(req, assignTagSchema);
    const tag = await assignTag(String(params.id), input, { log });
    return ok(tag, { status: 201 });
  },
  { rateLimit: "write" },
);
