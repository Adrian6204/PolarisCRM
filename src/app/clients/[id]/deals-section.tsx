"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StageKind } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { STAGE_KIND_STYLES, formatMoney } from "@/features/deals/display";
import { DealStageSelect } from "@/app/pipeline/deal-stage-select";
import { SimpleSelect } from "@/components/ui/select";

const UNASSIGNED = "__unassigned";

export interface PipelineView {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

export interface DealView {
  id: string;
  title: string;
  value: number;
  pipelineId: string;
  stageId: string;
  stageName: string;
  stageKind: StageKind;
  owner: { name: string | null; email: string } | null;
}

/**
 * Deals for a client — list with inline stage moves + a quick-add form.
 * A deal is opened on a chosen pipeline + stage. Winning a deal (a `won` stage)
 * promotes a prospect client to active (server-side).
 */
export function DealsSection({
  clientId,
  deals,
  pipelines,
  members,
  writable,
}: {
  clientId: string;
  deals: DealView[];
  pipelines: PipelineView[];
  members: { id: string; name: string | null; email: string }[];
  writable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed.");
    }
  }

  const totalOpen = deals
    .filter((d) => d.stageKind === StageKind.open)
    .reduce((sum, d) => sum + d.value, 0);
  const stagesFor = (pipelineId: string) => pipelines.find((p) => p.id === pipelineId)?.stages ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Deals{" "}
          {totalOpen > 0 && (
            <span className="text-sm font-normal text-muted">· {formatMoney(totalOpen)} open</span>
          )}
        </h2>
        {writable && !adding && pipelines.length > 0 && (
          <button onClick={() => setAdding(true)} className="text-sm link hover:underline">
            + Add deal
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <AddDealForm
          pipelines={pipelines}
          members={members}
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            run(async () => {
              await apiFetch(`/api/clients/${clientId}/deals`, {
                method: "POST",
                body: JSON.stringify(values),
              });
              setAdding(false);
            })
          }
        />
      )}

      {deals.length === 0 && !adding ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No deals yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                    {d.title}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_KIND_STYLES[d.stageKind]}`}>
                    {d.stageName}
                  </span>
                </div>
                <span className="text-sm text-muted">
                  {formatMoney(d.value)}
                  {d.owner ? ` · ${d.owner.name ?? d.owner.email}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {writable && (
                  <div className="w-32">
                    <DealStageSelect dealId={d.id} stageId={d.stageId} stages={stagesFor(d.pipelineId)} />
                  </div>
                )}
                {writable && (
                  <button
                    onClick={() => {
                      if (!confirm(`Delete deal "${d.title}"?`)) return;
                      run(() => apiFetch(`/api/deals/${d.id}`, { method: "DELETE" }));
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddDealForm({
  pipelines,
  members,
  onCancel,
  onSubmit,
}: {
  pipelines: PipelineView[];
  members: { id: string; name: string | null; email: string }[];
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    value: number;
    pipelineId: string;
    stageId: string;
    ownerId: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const stages = pipelines.find((p) => p.id === pipelineId)?.stages ?? [];
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState("");

  function onPipeline(id: string) {
    setPipelineId(id);
    // Reset the stage to the new pipeline's first stage.
    setStageId(pipelines.find((p) => p.id === id)?.stages[0]?.id ?? "");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!stageId) return;
        onSubmit({ title, value: Number(value) || 0, pipelineId, stageId, ownerId: ownerId || null });
      }}
      className="flex flex-col gap-3 rounded border border-line p-4"
    >
      <input required placeholder="Deal title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input type="number" min="0" placeholder="Value ($)" value={value} onChange={(e) => setValue(e.target.value)} className="input" />
        {pipelines.length > 1 && (
          <SimpleSelect value={pipelineId} onValueChange={onPipeline} aria-label="Pipeline" options={pipelines.map((p) => ({ value: p.id, label: p.name }))} />
        )}
        <SimpleSelect value={stageId} onValueChange={setStageId} aria-label="Stage" options={stages.map((s) => ({ value: s.id, label: s.name }))} />
        <SimpleSelect
          value={ownerId || UNASSIGNED}
          onValueChange={(v) => setOwnerId(v === UNASSIGNED ? "" : v)}
          aria-label="Owner"
          options={[{ value: UNASSIGNED, label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name ?? m.email }))]}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary !py-1.5">Add</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}
