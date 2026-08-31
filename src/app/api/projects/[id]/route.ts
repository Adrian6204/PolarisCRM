import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { updateProjectSchema } from "@/features/projects/schema";
import {
  getProject,
  softDeleteProject,
  updateProject,
} from "@/features/projects/service";

/**
 * /api/projects/:id
 *   GET    — project detail with its client (any authenticated user)
 *   PATCH  — update stage / status / dates / name (admin / project lead)
 *   DELETE — soft delete (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const project = await getProject(String(params.id), { withClient: true });
  return ok(project);
});

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, updateProjectSchema);
    const project = await updateProject(String(params.id), input, { log });
    return ok(project);
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await softDeleteProject(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
