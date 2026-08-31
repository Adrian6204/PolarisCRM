import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createDealSchema } from "@/features/deals/schema";
import { createDeal, listDeals } from "@/features/deals/service";

/**
 * /api/clients/:id/deals
 *   GET  — list a client's deals (any authenticated user)
 *   POST — open a deal for the client (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  const result = await listDeals({ clientId: String(params.id), page: 1, pageSize: 100 });
  return ok(result);
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createDealSchema);
    const deal = await createDeal(String(params.id), input, { log });
    return ok(deal, { status: 201 });
  },
  { rateLimit: "write" },
);
