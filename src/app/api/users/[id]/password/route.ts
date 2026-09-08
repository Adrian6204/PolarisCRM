import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { setPasswordSchema, adminSetPassword, changeOwnPassword } from "@/features/users/service";

/**
 * /api/users/:id/password
 *   PATCH — set a password. A user changing their OWN password must supply the
 *           current one; an admin may reset ANY user's password without it.
 */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireUser();
    const id = String(params.id);
    const input = await parseJson(req, setPasswordSchema);

    if (user.id === id) {
      await changeOwnPassword(id, input.currentPassword, input.password, { log });
    } else if (user.role === Role.admin) {
      await adminSetPassword(id, input.password, { log });
    } else {
      throw ApiError.forbidden("Only admins can change another user's password");
    }
    return ok({ id, updated: true });
  },
  { rateLimit: "write" },
);
