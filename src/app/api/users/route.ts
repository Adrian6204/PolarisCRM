import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * /api/users — team directory for owner/assignee pickers. Any authenticated
 * user; returns only non-sensitive fields (never password_hash).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  await requireUser();
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return ok(users);
});
