import { requirePageUser } from "@/lib/session";
import { getAnalytics } from "@/features/analytics/service";
import { serviceTypeLabel } from "@/features/projects/stages";
import { DEAL_STAGE_LABELS, formatMoney } from "@/features/deals/display";
import { DELIVERABLE_STATUS_LABELS } from "@/features/deliverables/status";
import { MagnitudeBars, CategoryBars } from "./charts";
import { StatTile, ChartCard, CompositionBar } from "./parts";

/** Analytics — KPIs + charts across pipeline, delivery, and workload. */
export const dynamic = "force-dynamic";

const RAMP = ["var(--chart-s1)", "var(--chart-s2)", "var(--chart-s3)", "var(--chart-s4)"];
const CLIENT_LABEL: Record<string, string> = { active: "Active", prospect: "Prospect", past: "Past" };

export default async function AnalyticsPage() {
  await requirePageUser();
  const a = await getAnalytics();

  // Pipeline bars: neutral ink for open stages, reserved status hues for won/lost.
  const pipelineData = a.pipelineByStage.map((p) => ({
    label: DEAL_STAGE_LABELS[p.stage],
    value: p.value,
    fill:
      p.stage === "won" ? "var(--chart-good)" : p.stage === "lost" ? "var(--chart-bad)" : "var(--chart-ink)",
  }));

  const serviceData = a.serviceLines
    .map((s) => ({ label: serviceTypeLabel(s.serviceType), value: s.active }))
    .sort((x, y) => y.value - x.value);

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
            <CategoryBars data={a.workload.map((w) => ({ label: w.name, value: w.count }))} unitLabel="deliverables" height={Math.max(160, a.workload.length * 44)} />
          ) : (
            <p className="empty">No assigned deliverables yet.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
