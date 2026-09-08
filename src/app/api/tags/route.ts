import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createTagSchema, listTags, createTag } from "@/features/tags/service";

/**
 * /api/tags
 *   GET  — the org-wide tag vocabulary (any authenticated user)
 *   POST — create a tag (any authenticated user — tags are shared vocabulary)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  await requireUser();
  return ok(await listTags());
});

export const POST = withApiRoute(
  async ({ req }) => {
    await requireUser();
    const input = await parseJson(req, createTagSchema);
    return ok(await createTag(input), { status: 201 });
  },
  { rateLimit: "write" },
);
