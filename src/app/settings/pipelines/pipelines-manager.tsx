"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StageKind } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { STAGE_KIND_LABELS } from "@/features/deals/display";

interface StageV {
  id: string;
  name: string;
  kind: StageKind;
}
interface PipelineV {
  id: string;
  name: string;
  archived: boolean;
  isDefault: boolean;
  stages: StageV[];
}

const KINDS = Object.values(StageKind);

/** Admin manager for pipelines + their stages. */
export function PipelinesManager({ isAdmin, initial }: { isAdmin: boolean; initial: PipelineV[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            run(() => apiFetch("/api/pipelines", { method: "POST", body: JSON.stringify({ name: newName.trim() }) }));
            setNewName("");
          }}
          className="card flex flex-wrap items-end gap-3 p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            New pipeline
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Onboarding" className="input !w-56" />
          </label>
          <button type="submit" className="btn btn-primary !py-1.5">Create</button>
          <span className="text-xs text-muted">Starts with Lead · Proposal · Won · Lost.</span>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {initial.map((p) => (
        <PipelineCard key={p.id} pipeline={p} isAdmin={isAdmin} run={run} />
      ))}
    </div>
  );
}

function PipelineCard({
  pipeline,
  isAdmin,
  run,
}: {
  pipeline: PipelineV;
  isAdmin: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState(pipeline.name);
  const [newStage, setNewStage] = useState("");
  const p = pipeline;

  function renamePipeline() {
    if (name.trim() && name.trim() !== p.name)
      run(() => apiFetch(`/api/pipelines/${p.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) }));
  }

  return (
    <div className={`card flex flex-col gap-4 p-4 ${p.archived ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={renamePipeline} className="input !w-56 font-medium" />
          ) : (
            <span className="font-medium">{p.name}</span>
          )}
          {p.isDefault && (
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">Default</span>
          )}
          {p.archived && (
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">Archived</span>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3 text-sm">
            {!p.isDefault && !p.archived && (
              <button onClick={() => run(() => apiFetch(`/api/pipelines/${p.id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }))} className="link hover:underline">
                Set default
              </button>
            )}
            <button
              onClick={() => run(() => apiFetch(`/api/pipelines/${p.id}`, { method: "PATCH", body: JSON.stringify({ archived: !p.archived }) }))}
              className="text-muted hover:text-fg"
            >
              {p.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete pipeline "${p.name}"? This cannot be undone.`))
                  run(() => apiFetch(`/api/pipelines/${p.id}`, { method: "DELETE" }));
              }}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {p.stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2">
            <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
            <StageRow stage={s} pipelineId={p.id} isAdmin={isAdmin} run={run} canUp={i > 0} canDown={i < p.stages.length - 1}
              onMove={(dir) => {
                const ids = p.stages.map((x) => x.id);
                const j = dir === "up" ? i - 1 : i + 1;
                [ids[i], ids[j]] = [ids[j], ids[i]];
                run(() => apiFetch(`/api/pipelines/${p.id}/stages`, { method: "PUT", body: JSON.stringify({ stageIds: ids }) }));
              }}
            />
          </li>
        ))}
      </ul>

      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newStage.trim()) return;
            run(() => apiFetch(`/api/pipelines/${p.id}/stages`, { method: "POST", body: JSON.stringify({ name: newStage.trim() }) }));
            setNewStage("");
          }}
          className="flex items-center gap-2"
        >
          <input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="Add a stage…" className="input !w-56 !py-1 text-sm" />
          <button type="submit" className="btn btn-secondary !py-1">Add stage</button>
        </form>
      )}
    </div>
  );
}

function StageRow({
  stage,
  pipelineId,
  isAdmin,
  run,
  canUp,
  canDown,
  onMove,
}: {
  stage: StageV;
  pipelineId: string;
  isAdmin: boolean;
  run: (fn: () => Promise<unknown>) => void;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: "up" | "down") => void;
}) {
  const [name, setName] = useState(stage.name);
  const url = `/api/pipelines/${pipelineId}/stages/${stage.id}`;

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-between">
        <span className="text-sm">{stage.name}</span>
        <span className="text-xs text-muted">{STAGE_KIND_LABELS[stage.kind]}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== stage.name && run(() => apiFetch(url, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) }))}
        className="input !w-48 !py-1 text-sm"
      />
      <select
        value={stage.kind}
        onChange={(e) => run(() => apiFetch(url, { method: "PATCH", body: JSON.stringify({ kind: e.target.value }) }))}
        className="input !w-auto !py-1 text-sm"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>{STAGE_KIND_LABELS[k]}</option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-1 text-muted">
        <button onClick={() => onMove("up")} disabled={!canUp} className="px-1 disabled:opacity-30 hover:text-fg" aria-label="Move up">↑</button>
        <button onClick={() => onMove("down")} disabled={!canDown} className="px-1 disabled:opacity-30 hover:text-fg" aria-label="Move down">↓</button>
        <button
          onClick={() => run(() => apiFetch(url, { method: "DELETE" }))}
          className="px-1 text-red-600 hover:underline dark:text-red-400"
          aria-label="Delete stage"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
