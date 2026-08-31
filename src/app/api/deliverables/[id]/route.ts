import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { updateDeliverableSchema } from "@/features/deliverables/schema";
import {
  getDeliverable,
  softDeleteDeliverable,
  updateDeliverable,
} from "@/features/deliverables/service";

/**
 * /api/deliverables/:id
 *   GET    — deliverable detail (any authenticated user)
 *   PATCH  — update. Status-only changes are the fast, daily-use action and are
 *            allowed for ANY authenticated user; structural edits (title, owner,
 *            due date, description) require admin / project lead.
 *   DELETE — soft delete (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const deliverable = await getDeliverable(String(params.id));
  return ok(deliverable);
});

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    // Everyone must be authenticated; the role required depends on what's being
    // changed (see below).
    let user = await requireUser();
    const input = await parseJson(req, updateDeliverableSchema);

    const onlyStatus =
      Object.keys(input).length === 1 && "status" in input;
    if (!onlyStatus) {
      user = await requireRole(Role.admin, Role.project_lead);
    }

    const deliverable = await updateDeliverable(String(params.id), input, {
      log,
      actorId: user.id,
    });
    return ok(deliverable);
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    await softDeleteDeliverable(String(params.id), { log, actorId: user.id });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
