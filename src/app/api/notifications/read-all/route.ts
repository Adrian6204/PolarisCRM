import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/features/notifications/service";

/** /api/notifications/read-all — mark all of the caller's notifications read. */
export const dynamic = "force-dynamic";

export const POST = withApiRoute(
  async () => {
    const user = await requireUser();
    await markAllRead(user.id);
    return ok({ ok: true });
  },
  { rateLimit: "write" },
);
