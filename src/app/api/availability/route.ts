import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { setAvailabilitySchema, getUserAvailability, setUserAvailability } from "@/features/availability/service";

/**
 * /api/availability?userId=…
 *   GET — a user's weekly availability rules (any authed user; defaults to self)
 *   PUT — replace availability. A user may set their own; admins may set anyone's.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  const user = await requireUser();
  const userId = new URL(req.url).searchParams.get("userId") ?? user.id;
  return ok(await getUserAvailability(userId));
});

export const PUT = withApiRoute(
  async ({ req, log }) => {
    const user = await requireUser();
    const userId = new URL(req.url).searchParams.get("userId") ?? user.id;
    if (userId !== user.id && user.role !== Role.admin) {
      throw ApiError.forbidden("Only admins can edit another user's availability");
    }
    const input = await parseJson(req, setAvailabilitySchema);
    return ok(await setUserAvailability(userId, input, { log }));
  },
  { rateLimit: "write" },
);
