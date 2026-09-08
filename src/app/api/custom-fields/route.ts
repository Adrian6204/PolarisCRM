import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createFieldDefSchema, listFieldDefs, createFieldDef } from "@/features/custom-fields/service";

/**
 * /api/custom-fields
 *   GET  — custom field definitions (any authenticated user). Pass
 *          ?includeArchived=1 to include archived defs (admin tooling).
 *   POST — define a new custom field (admin only).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "1";
  return ok(await listFieldDefs({ includeArchived }));
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, createFieldDefSchema);
    return ok(await createFieldDef(input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
