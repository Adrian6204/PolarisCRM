import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createDeliverableSchema } from "@/features/deliverables/schema";
import {
  createDeliverable,
  listDeliverables,
} from "@/features/deliverables/service";

/**
 * /api/projects/:id/deliverables
 *   GET  — list a project's deliverables (any authenticated user)
 *   POST — add a deliverable (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const result = await listDeliverables({
    projectId: String(params.id),
    page: 1,
    pageSize: 200,
  });
  return ok(result);
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createDeliverableSchema);
    const deliverable = await createDeliverable(String(params.id), input, { log });
    return ok(deliverable, { status: 201 });
  },
  { rateLimit: "write" },
);
