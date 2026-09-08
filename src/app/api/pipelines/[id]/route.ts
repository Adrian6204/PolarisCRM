import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updatePipelineSchema, updatePipeline, deletePipeline } from "@/features/pipelines/service";

/**
 * /api/pipelines/:id
 *   PATCH  — rename / archive / set default / reorder (admin).
 *   DELETE — remove a pipeline (admin; refused while it has deals).
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, updatePipelineSchema);
    return ok(await updatePipeline(String(params.id), input, { log }));
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin);
    await deletePipeline(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
