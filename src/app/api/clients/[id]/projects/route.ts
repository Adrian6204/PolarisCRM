import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createProjectSchema } from "@/features/projects/schema";
import { createProject, listProjects } from "@/features/projects/service";

/**
 * /api/clients/:id/projects
 *   GET  — list a client's projects (any authenticated user)
 *   POST — create a project under the client (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const result = await listProjects({
    clientId: String(params.id),
    page: 1,
    pageSize: 100,
  });
  return ok(result);
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createProjectSchema);
    const project = await createProject(String(params.id), input, { log, actorId: user.id });
    return ok(project, { status: 201 });
  },
  { rateLimit: "write" },
);
