import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, unreadCount } from "@/features/notifications/service";

/**
 * /api/notifications — the current user's recent notifications + unread count.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async () => {
  const user = await requireUser();
  const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return ok({ items, unread });
});
