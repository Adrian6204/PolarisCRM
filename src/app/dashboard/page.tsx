import Link from "next/link";
import { requirePageUser } from "@/lib/session";
import { getUpcomingRenewals } from "@/features/renewals/service";
import { getServiceLineStats } from "@/features/reports/service";
import { getPipelineStats } from "@/features/deals/service";
import { serviceTypeLabel, SERVICE_TYPES } from "@/features/projects/stages";
import { DEAL_STAGES, DEAL_STAGE_LABELS, formatMoney } from "@/features/deals/display";
import { IconChevronRight } from "@/components/icons";

/** Dashboard — renewals, service-line load, and pipeline at a glance. */
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 60;

function urgencyClass(days: number): string {
  if (days <= 7) return "text-red-600 dark:text-red-400";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-muted";
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const [renewals, serviceLines, pipeline] = await Promise.all([
    getUpcomingRenewals(WINDOW_DAYS),
    getServiceLineStats(),
    getPipelineStats(),
  ]);
  const pipelineByStage = new Map(pipeline.map((p) => [p.stage, p]));
  const counts = new Map(serviceLines.map((s) => [s.serviceType, s.active]));
  const totalActive = serviceLines.reduce((n, s) => n + s.active, 0);
  const pipelineTotal = pipeline
    .filter((p) => p.stage === "lead" || p.stage === "proposal")
    .reduce((n, p) => n + p.value, 0);
  const greeting = user.email.split("@")[0];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome back, <span className="capitalize">{greeting}</span> — here&rsquo;s where things stand.
        </p>
      </header>

      {/* Active engagements by service line */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Active engagements</h2>
          <span className="text-sm text-muted">
            <span className="font-mono-nums font-medium text-fg">{totalActive}</span> active
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-stagger>
          {SERVICE_TYPES.map((s) => (
            <Link key={s} href={`/projects?serviceType=${s}`} className="card flex flex-col gap-1 p-4 transition-colors hover:border-line-strong">
              <span className="font-mono-nums text-3xl font-semibold tabular-nums">{counts.get(s) ?? 0}</span>
              <span className="text-xs font-medium text-muted">{serviceTypeLabel(s)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sales pipeline */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Sales pipeline</h2>
          <Link href="/pipeline" className="inline-flex items-center gap-0.5 text-sm link">
            View board <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-stagger>
          {DEAL_STAGES.map((s) => {
            const stat = pipelineByStage.get(s);
            return (
              <Link key={s} href="/pipeline" className="card flex flex-col gap-1 p-4 transition-colors hover:border-line-strong">
                <span className="font-mono-nums text-xl font-semibold tabular-nums">{formatMoney(stat?.value ?? 0)}</span>
                <span className="text-xs font-medium text-muted">
                  {DEAL_STAGE_LABELS[s]} · <span className="font-mono-nums">{stat?.count ?? 0}</span>
                </span>
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          <span className="font-mono-nums font-medium text-fg">{formatMoney(pipelineTotal)}</span> in open opportunities.
        </p>
      </section>

      {/* Upcoming renewals */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Upcoming renewals</h2>
          <span className="text-sm text-muted">next {WINDOW_DAYS} days</span>
        </div>

        {renewals.length === 0 ? (
          <p className="empty">No retainer renewals in the next {WINDOW_DAYS} days.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden" data-stagger>
            {renewals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface">
                <div className="flex flex-col">
                  <Link href={`/projects/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-sm text-muted">
                    <Link href={`/clients/${r.client.id}`} className="hover:underline">
                      {r.client.name}
                    </Link>{" "}
                    · {serviceTypeLabel(r.serviceType)}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${urgencyClass(r.daysUntil)}`}>
                    {r.daysUntil === 0 ? "Due today" : r.daysUntil === 1 ? "in 1 day" : `in ${r.daysUntil} days`}
                  </div>
                  <div className="font-mono-nums text-xs text-muted">
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
