import Link from "next/link";
import { requirePageUser, canWrite } from "@/lib/session";
import { listDeals, getPipelineStats, type DealWithRefs } from "@/features/deals/service";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  formatMoney,
} from "@/features/deals/display";
import { DealStageSelect } from "./deal-stage-select";

/**
 * Sales pipeline board (Phase 8): a column per stage (lead → proposal →
 * won/lost) across all clients. Cards show value, client and owner; writers can
 * move a deal between stages inline.
 */
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await requirePageUser();
  const writable = canWrite(user.role);

  const [{ items }, stats] = await Promise.all([
    listDeals({ page: 1, pageSize: 200 }),
    getPipelineStats(),
  ]);
  const deals = items as DealWithRefs[];
  const statByStage = new Map(stats.map((s) => [s.stage, s]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEAL_STAGES.map((stage) => {
          const list = deals.filter((d) => d.stage === stage);
          const stat = statByStage.get(stage);
          return (
            <div key={stage} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{DEAL_STAGE_LABELS[stage]}</h2>
                <span className="text-xs text-muted">
                  {formatMoney(stat?.value ?? 0)} · {stat?.count ?? 0}
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
                    <DealStageSelect dealId={d.id} stage={d.stage} disabled={!writable} />
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
