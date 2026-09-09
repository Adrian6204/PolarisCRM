import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markRead } from "@/features/notifications/service";

/** /api/notifications/:id — mark a single notification read (owner only). */
export const dynamic = "force-dynamic";

export const PATCH = withApiRoute(
  async ({ params }) => {
    const user = await requireUser();
    await markRead(String(params.id), user.id);
    return ok({ id: params.id, read: true });
  },
  { rateLimit: "write" },
);
