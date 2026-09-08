import { requirePageUser } from "@/lib/session";
import { getUserAvailability } from "@/features/availability/service";
import { AvailabilityEditor } from "./availability-editor";

/**
 * Availability settings: the signed-in user's weekly bookable hours, used by
 * the calendar's slot finder.
 */
export const dynamic = "force-dynamic";

export default async function AvailabilitySettingsPage() {
  const user = await requirePageUser();
  const rules = await getUserAvailability(user.id);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Your weekly bookable hours. The calendar&rsquo;s slot finder offers open
        times within these windows.
      </p>
      <AvailabilityEditor
        initial={rules.map((r) => ({ weekday: r.weekday, startMin: r.startMin, endMin: r.endMin }))}
      />
    </div>
  );
}
