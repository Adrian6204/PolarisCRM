import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createAutomationSchema, listAutomations, createAutomation } from "@/features/automations/service";

/**
 * /api/automations
 *   GET  — all automations with their actions (any authed user).
 *   POST — create an automation rule (admin).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  await requireUser();
  return ok(await listAutomations());
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, createAutomationSchema);
    return ok(await createAutomation(input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
