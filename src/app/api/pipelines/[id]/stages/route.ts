import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createStageSchema, reorderStagesSchema, addStage, reorderStages } from "@/features/pipelines/service";

/**
 * /api/pipelines/:id/stages
 *   POST — add a stage to the pipeline (admin).
 *   PUT  — persist a new stage order (admin).
 */
export const dynamic = "force-dynamic";

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, createStageSchema);
    return ok(await addStage(String(params.id), input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);

export const PUT = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const { stageIds } = await parseJson(req, reorderStagesSchema);
    await reorderStages(String(params.id), stageIds, { log });
    return ok({ ok: true });
  },
  { rateLimit: "write" },
);
