import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserSchema, createUser } from "@/features/users/service";

/**
 * /api/users
 *   GET  — team directory for owner/assignee pickers (any authed user);
 *          returns only non-sensitive fields (never password_hash).
 *   POST — provision a new account (admin).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  await requireUser();
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { name: "asc" },
  });
  return ok(users);
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    await requireRole(Role.admin);
    const input = await parseJson(req, createUserSchema);
    return ok(await createUser(input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
