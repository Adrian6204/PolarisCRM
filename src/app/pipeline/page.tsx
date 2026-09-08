import Link from "next/link";
import { requirePageUser, canWrite } from "@/lib/session";
import { listDeals, getPipelineStats, type DealWithRefs } from "@/features/deals/service";
import { listPipelines } from "@/features/pipelines/service";
import { formatMoney } from "@/features/deals/display";
import { DealStageSelect } from "./deal-stage-select";

/**
 * Sales pipeline board (G2): a column per stage of the selected pipeline,
 * across all clients. Multiple pipelines are switchable via tabs. Cards show
 * value, client and owner; writers can move a deal between stages inline.
 */
export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const writable = canWrite(user.role);
  const pipelines = await listPipelines();

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="empty">
          No pipelines yet.{" "}
          <Link href="/settings/pipelines" className="link hover:underline">Create one</Link> to start tracking deals.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const selected =
    pipelines.find((p) => p.id === sp.pipeline) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0];

  const [{ items }, stats] = await Promise.all([
    listDeals({ pipelineId: selected.id, page: 1, pageSize: 200 }),
    getPipelineStats(selected.id),
  ]);
  const deals = items as DealWithRefs[];
  const stageOptions = selected.stages.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <Link href="/settings/pipelines" className="text-sm link hover:underline">
          Manage pipelines
        </Link>
      </div>

      {pipelines.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-line">
          {pipelines.map((p) => {
            const active = p.id === selected.id;
            return (
              <Link
                key={p.id}
                href={`/pipeline?pipeline=${p.id}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {stats.map((stage) => {
          const list = deals.filter((d) => d.stageId === stage.stageId);
          return (
            <div key={stage.stageId} className="flex w-72 shrink-0 flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{stage.name}</h2>
                <span className="text-xs text-muted">
                  {formatMoney(stage.value)} · {stage.count}
                </span>
              </div>
              <div className="flex min-h-16 flex-col gap-2 rounded-lg bg-surface p-2">
                {list.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-2 rounded-md border border-line bg-bg p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/deals/${d.id}`} className="text-sm font-medium hover:underline">
                        {d.title}
                      </Link>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                        {formatMoney(d.value)}
                      </span>
                    </div>
                    <Link href={`/clients/${d.clientId}`} className="text-xs text-muted hover:underline">
                      {d.client.name}
                    </Link>
                    <span className="text-xs text-muted">
                      {d.owner ? (d.owner.name ?? d.owner.email) : "Unassigned"}
                    </span>
                    <DealStageSelect dealId={d.id} stageId={d.stageId} stages={stageOptions} disabled={!writable} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
