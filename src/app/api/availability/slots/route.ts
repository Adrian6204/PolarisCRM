import { withApiRoute, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { computeSlots } from "@/features/availability/service";

/**
 * /api/availability/slots?userId=…&date=YYYY-MM-DD&duration=30
 *   GET — bookable slots for a host on a day at the given slot length (minutes).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const p = new URL(req.url).searchParams;
  const userId = p.get("userId");
  const date = p.get("date");
  const duration = Number(p.get("duration") ?? "30");
  if (!userId || !date) throw ApiError.badRequest("userId and date are required");
  return ok(await computeSlots(userId, date, duration));
});
