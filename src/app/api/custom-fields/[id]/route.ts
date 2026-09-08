import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { updateFieldDefSchema, updateFieldDef, deleteFieldDef } from "@/features/custom-fields/service";

/**
 * /api/custom-fields/:id
 *   PATCH  — update a definition (label, options, order, archived) — admin.
 *   DELETE — remove a definition and all its values (cascade) — admin.
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, updateFieldDefSchema);
    return ok(await updateFieldDef(String(params.id), input, { log }));
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin);
    await deleteFieldDef(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
