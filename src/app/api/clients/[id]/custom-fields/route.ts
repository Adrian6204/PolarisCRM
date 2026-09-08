import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { setValuesSchema, getClientCustomFields, setClientCustomFields } from "@/features/custom-fields/service";

/**
 * /api/clients/:id/custom-fields
 *   GET — active definitions joined with this client's values (any authed user)
 *   PUT — bulk-set this client's values (admin / project lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await getClientCustomFields(String(params.id)));
});

export const PUT = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, setValuesSchema);
    return ok(await setClientCustomFields(String(params.id), input, { log }));
  },
  { rateLimit: "write" },
);
