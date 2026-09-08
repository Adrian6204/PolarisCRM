import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createPipelineSchema, listPipelines, createPipeline } from "@/features/pipelines/service";

/**
 * /api/pipelines
 *   GET  — pipelines with their stages (any authed user). ?includeArchived=1
 *          to include archived pipelines (admin tooling).
 *   POST — create a pipeline (admin).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "1";
  return ok(await listPipelines({ includeArchived }));
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, createPipelineSchema);
    return ok(await createPipeline(input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
