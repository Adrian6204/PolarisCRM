import { requirePageUser } from "@/lib/session";
import { getAnalytics, getPerformanceReport } from "@/features/analytics/service";
import { serviceTypeLabel } from "@/features/projects/stages";
import { formatMoney } from "@/features/deals/display";
import { DELIVERABLE_STATUS_LABELS } from "@/features/deliverables/status";
import { MagnitudeBars, CategoryBars } from "./charts";
import { StatTile, ChartCard, CompositionBar } from "./parts";
import { RangeTabs } from "./range-tabs";

/** Analytics — KPIs + charts across pipeline, delivery, and workload. */
export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = { "30d": 30, "90d": 90, "365d": 365 };

const RAMP = ["var(--chart-s1)", "var(--chart-s2)", "var(--chart-s3)", "var(--chart-s4)"];
// Categorical mono scale (strong→weak) — a distinct lightness step per tier.
const CAT = [
  "var(--chart-c1)",
  "var(--chart-c2)",
  "var(--chart-c3)",
  "var(--chart-c4)",
  "var(--chart-c5)",
];
const catFill = (i: number) => CAT[i % CAT.length];
const CLIENT_LABEL: Record<string, string> = { active: "Active", prospect: "Prospect", past: "Past" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageUser();
  const sp = await searchParams;
  const rangeKey = sp.range && RANGE_DAYS[sp.range] ? sp.range : "90d";
  const to = new Date();
  const from = new Date(to.getTime() - RANGE_DAYS[rangeKey] * 86_400_000);
  const [a, perf] = await Promise.all([getAnalytics(), getPerformanceReport({ from, to })]);
  const perfWinRate = perf.sales.winRate === null ? "—" : `${Math.round(perf.sales.winRate * 100)}%`;

  // Each tier gets its own step from the monochrome categorical scale.
  const pipelineData = a.pipelineByStage.map((p, i) => ({
    label: p.name,
    value: p.value,
    fill: catFill(i),
  }));

  const serviceData = a.serviceLines
    .map((s) => ({ label: serviceTypeLabel(s.serviceType), value: s.active }))
    .sort((x, y) => y.value - x.value)
    .map((d, i) => ({ ...d, fill: catFill(i) }));

  const deliverableSegments = a.deliverablesByStatus.map((d, i) => ({
    label: DELIVERABLE_STATUS_LABELS[d.status],
    value: d.count,
    color: RAMP[i],
  }));

  // active = strongest ramp step, past = faintest.
  const clientRampByStatus: Record<string, string> = {
    active: "var(--chart-s4)",
    prospect: "var(--chart-s3)",
    past: "var(--chart-s1)",
  };
  const clientSegments = a.clientsByStatus.map((c) => ({
    label: CLIENT_LABEL[c.status] ?? c.status,
    value: c.count,
    color: clientRampByStatus[c.status] ?? "var(--chart-s2)",
  }));

  const winRate = a.kpis.winRate === null ? "—" : `${Math.round(a.kpis.winRate * 100)}%`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">Pipeline, delivery, and workload across the agency.</p>
      </header>

      {/* Performance report — time-bounded sales outcomes + leaderboard */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Performance</h2>
          <RangeTabs active={rangeKey} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-stagger>
          <StatTile label="Deals created" value={String(perf.sales.created)} />
          <StatTile label="Won" value={String(perf.sales.won)} tone={perf.sales.won > 0 ? "good" : undefined} />
          <StatTile label="Lost" value={String(perf.sales.lost)} />
          <StatTile label="Win rate" value={perfWinRate} caption="won / closed" />
          <StatTile label="Won value" value={formatMoney(perf.sales.wonValue)} />
          <StatTile label="Avg cycle" value={perf.sales.avgCycleDays === null ? "—" : `${perf.sales.avgCycleDays}d`} caption="create → close" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2" data-stagger>
          <ChartCard title="Sales leaderboard" caption="Won value per owner in range.">
            {perf.leaderboard.length > 0 ? (
              <CategoryBars data={perf.leaderboard.map((l, i) => ({ label: l.name, value: l.wonValue, fill: catFill(i) }))} unitLabel="won value" format="money" height={Math.max(160, perf.leaderboard.length * 44)} />
            ) : (
              <p className="empty">No deals won in this period.</p>
            )}
          </ChartCard>
          <ChartCard title="Activity by user" caption="Logged calls, emails, meetings & notes in range.">
            {perf.activityByUser.length > 0 ? (
              <CategoryBars data={perf.activityByUser.map((u, i) => ({ label: u.name, value: u.count, fill: catFill(i) }))} unitLabel="activities" height={Math.max(160, perf.activityByUser.length * 44)} />
            ) : (
              <p className="empty">No activity logged in this period.</p>
            )}
          </ChartCard>
        </div>
      </section>

      {/* KPI tiles — headline numbers (not charts) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-stagger>
        <StatTile label="Active clients" value={String(a.kpis.activeClients)} />
        <StatTile label="Active projects" value={String(a.kpis.activeProjects)} />
        <StatTile label="Open pipeline" value={formatMoney(a.kpis.openPipeline)} />
        <StatTile label="Win rate" value={winRate} caption="won / closed" />
        <StatTile
          label="Overdue"
          value={String(a.kpis.overdue)}
          tone={a.kpis.overdue > 0 ? "bad" : undefined}
          caption="past due date"
        />
        <StatTile
          label="Deliverables done"
          value={`${a.kpis.deliverablesDone}/${a.kpis.deliverablesTotal}`}
          caption="completed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2" data-stagger>
        <ChartCard title="Pipeline by stage" caption="Total deal value in each stage.">
          <MagnitudeBars data={pipelineData} format="money" unitLabel="value" />
        </ChartCard>

        <ChartCard title="Active projects by service line" caption="Live engagements per service.">
          {serviceData.some((d) => d.value > 0) ? (
            <CategoryBars data={serviceData} unitLabel="projects" />
          ) : (
            <p className="empty">No active projects.</p>
          )}
        </ChartCard>

        <ChartCard title="Deliverables by status" caption="Where current work sits, not-started → done.">
          <CompositionBar segments={deliverableSegments} />
        </ChartCard>

        <ChartCard title="Client mix" caption="Composition of the client book.">
          <CompositionBar segments={clientSegments} />
        </ChartCard>

        <ChartCard title="Workload by owner" caption="Open + assigned deliverables per team member." className="lg:col-span-2">
          {a.workload.length > 0 ? (
            <CategoryBars data={a.workload.map((w, i) => ({ label: w.name, value: w.count, fill: catFill(i) }))} unitLabel="deliverables" height={Math.max(160, a.workload.length * 44)} />
          ) : (
            <p className="empty">No assigned deliverables yet.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
