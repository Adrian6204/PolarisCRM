import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateStageSchema, updateStage, deleteStage } from "@/features/pipelines/service";

/**
 * /api/pipelines/:id/stages/:stageId
 *   PATCH  — rename / recolor(kind) / reorder a stage (admin).
 *   DELETE — remove a stage (admin; refused while it has deals).
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, updateStageSchema);
    return ok(await updateStage(String(params.stageId), input, { log }));
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin);
    await deleteStage(String(params.stageId), { log });
    return ok({ id: params.stageId, deleted: true });
  },
  { rateLimit: "write" },
);
