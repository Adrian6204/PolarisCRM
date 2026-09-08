import { Role } from "@prisma/client";
import { withApiRoute, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { deleteNote } from "@/features/notes/service";

/**
 * /api/notes/:id
 *   DELETE — remove a note (admin / project lead).
 */
export const dynamic = "force-dynamic";

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteNote(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
