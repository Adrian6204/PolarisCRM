"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DealStage } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_STYLES,
  formatMoney,
} from "@/features/deals/display";
import { DealStageSelect } from "@/app/pipeline/deal-stage-select";

export interface DealView {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  owner: { name: string | null; email: string } | null;
}

/**
 * Deals for a client (Phase 8) — list with inline stage moves + a quick-add
 * form. Winning a deal promotes a prospect client to active (server-side).
 */
export function DealsSection({
  clientId,
  deals,
  members,
  writable,
}: {
  clientId: string;
  deals: DealView[];
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
    .filter((d) => d.stage === DealStage.lead || d.stage === DealStage.proposal)
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Deals{" "}
          {totalOpen > 0 && (
            <span className="text-sm font-normal text-muted">
              · {formatMoney(totalOpen)} open
            </span>
          )}
        </h2>
        {writable && !adding && (
          <button onClick={() => setAdding(true)} className="text-sm link hover:underline">
            + Add deal
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <AddDealForm
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEAL_STAGE_STYLES[d.stage]}`}>
                    {DEAL_STAGE_LABELS[d.stage]}
                  </span>
                </div>
                <span className="text-sm text-muted">
                  {formatMoney(d.value)}
                  {d.owner ? ` · ${d.owner.name ?? d.owner.email}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {writable && <div className="w-32"><DealStageSelect dealId={d.id} stage={d.stage} /></div>}
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
  members,
  onCancel,
  onSubmit,
}: {
  members: { id: string; name: string | null; email: string }[];
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    value: number;
    stage: DealStage;
    ownerId: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>(DealStage.lead);
  const [ownerId, setOwnerId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, value: Number(value) || 0, stage, ownerId: ownerId || null });
      }}
      className="flex flex-col gap-3 rounded border border-line p-4"
    >
      <input required placeholder="Deal title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      <div className="grid grid-cols-3 gap-3">
        <input type="number" min="0" placeholder="Value ($)" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
        <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)} className={inputClass}>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
          ))}
        </select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary !py-1.5">
          Add
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "input";
