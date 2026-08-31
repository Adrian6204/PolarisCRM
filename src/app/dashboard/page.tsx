import Link from "next/link";
import { requirePageUser } from "@/lib/session";
import { getUpcomingRenewals } from "@/features/renewals/service";
import { getServiceLineStats } from "@/features/reports/service";
import { serviceTypeLabel, SERVICE_TYPES } from "@/features/projects/stages";

/**
 * Dashboard (Phase 5) — leads with the "renewing in X days" widget for active
 * retainers, sorted soonest first. Broader reporting/dashboards arrive in
 * Phase 6.
 */
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 60;

function urgencyClass(days: number): string {
  if (days <= 7) return "text-red-600 dark:text-red-400";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500";
}

export default async function DashboardPage() {
  await requirePageUser();
  const [renewals, serviceLines] = await Promise.all([
    getUpcomingRenewals(WINDOW_DAYS),
    getServiceLineStats(),
  ]);
  // Present every service line (0 when none active), in the canonical order.
  const counts = new Map(serviceLines.map((s) => [s.serviceType, s.active]));
  const totalActive = serviceLines.reduce((n, s) => n + s.active, 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Active engagements by service line</h2>
          <span className="text-sm text-gray-500">{totalActive} active</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICE_TYPES.map((s) => (
            <Link
              key={s}
              href={`/projects?serviceType=${s}`}
              className="flex flex-col gap-1 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
            >
              <span className="text-2xl font-semibold tabular-nums">{counts.get(s) ?? 0}</span>
              <span className="text-xs text-gray-500">{serviceTypeLabel(s)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Upcoming renewals</h2>
          <span className="text-sm text-gray-500">next {WINDOW_DAYS} days</span>
        </div>

        {renewals.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            No retainer renewals in the next {WINDOW_DAYS} days.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-900 dark:border-gray-800">
            {renewals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <Link href={`/projects/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-sm text-gray-500">
                    <Link href={`/clients/${r.client.id}`} className="hover:underline">
                      {r.client.name}
                    </Link>{" "}
                    · {serviceTypeLabel(r.serviceType)}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${urgencyClass(r.daysUntil)}`}>
                    {r.daysUntil === 0
                      ? "Due today"
                      : r.daysUntil === 1
                        ? "in 1 day"
                        : `in ${r.daysUntil} days`}
                  </div>
                  <div className="text-xs text-gray-400">
                    {r.retainerRenewalDate?.toISOString().slice(0, 10)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
