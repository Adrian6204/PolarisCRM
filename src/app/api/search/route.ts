import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { search } from "@/features/search/service";

/**
 * /api/search?q=… — cross-entity quick search for the command palette.
 * Any authenticated user.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(await search(q));
});
