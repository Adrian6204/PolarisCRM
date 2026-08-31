import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { updateDealSchema } from "@/features/deals/schema";
import { getDeal, softDeleteDeal, updateDeal } from "@/features/deals/service";

/**
 * /api/deals/:id
 *   GET    — deal detail (any authenticated user)
 *   PATCH  — update stage / value / owner / dates (admin / project lead)
 *   DELETE — soft delete (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await getDeal(String(params.id)));
});

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, updateDealSchema);
    const deal = await updateDeal(String(params.id), input, { log });
    return ok(deal);
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await softDeleteDeal(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
