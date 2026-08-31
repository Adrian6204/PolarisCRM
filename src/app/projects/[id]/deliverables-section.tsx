"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeliverableStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import {
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABELS,
} from "@/features/deliverables/status";

export interface DeliverableView {
  id: string;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  owner: { id: string; name: string | null; email: string } | null;
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Deliverables board for a project (Phase 3). A column per status; cards show
 * owner + due date. Status is the fast, daily-use action — a one-change select
 * on every card (allowed for any signed-in user by the API). Structural edits
 * (assign, due date, delete, add) are shown only to writers.
 */
export function DeliverablesSection({
  projectId,
  deliverables,
  members,
  writable,
}: {
  projectId: string;
  deliverables: DeliverableView[];
  members: TeamMember[];
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

  const byStatus = (s: DeliverableStatus) =>
    deliverables.filter((d) => d.status === s);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deliverables</h2>
        {writable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm link hover:underline"
          >
            + Add deliverable
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DELIVERABLE_STATUSES.map((status) => {
          const list = byStatus(status);
          return (
            <div key={status} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">
                  {DELIVERABLE_STATUS_LABELS[status]}
                </h3>
                <span className="text-xs text-muted">{list.length}</span>
              </div>
              <div className="flex min-h-16 flex-col gap-2 rounded-lg bg-surface p-2">
                {list.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    deliverable={d}
                    writable={writable}
                    onStatus={(next) =>
                      run(() =>
                        apiFetch(`/api/deliverables/${d.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ status: next }),
                        }),
                      )
                    }
                    onDelete={() => {
                      if (!confirm(`Delete "${d.title}"?`)) return;
                      run(() => apiFetch(`/api/deliverables/${d.id}`, { method: "DELETE" }));
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddDeliverableForm
          members={members}
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            run(async () => {
              await apiFetch(`/api/projects/${projectId}/deliverables`, {
                method: "POST",
                body: JSON.stringify(values),
              });
              setAdding(false);
            })
          }
        />
      )}
    </section>
  );
}

function DeliverableCard({
  deliverable: d,
  writable,
  onStatus,
  onDelete,
}: {
  deliverable: DeliverableView;
  writable: boolean;
  onStatus: (s: DeliverableStatus) => void;
  onDelete: () => void;
}) {
  const overdue =
    d.dueDate && d.status !== DeliverableStatus.done && new Date(d.dueDate) < new Date();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-bg p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{d.title}</span>
        {writable && (
          <button
            onClick={onDelete}
            className="text-xs text-red-600 hover:underline dark:text-red-400"
            aria-label="Delete deliverable"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{d.owner ? (d.owner.name ?? d.owner.email) : "Unassigned"}</span>
        {d.dueDate && (
          <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
            · due {d.dueDate}
          </span>
        )}
      </div>
      {/* Fast status change — the core daily-use action. */}
      <select
        value={d.status}
        onChange={(e) => onStatus(e.target.value as DeliverableStatus)}
        className="w-full rounded border border-line bg-transparent px-1.5 py-1 text-xs"
      >
        {DELIVERABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DELIVERABLE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function AddDeliverableForm({
  members,
  onCancel,
  onSubmit,
}: {
  members: TeamMember[];
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    ownerId: string | null;
    dueDate: string | null;
    status: DeliverableStatus;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<DeliverableStatus>(DeliverableStatus.not_started);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, ownerId: ownerId || null, dueDate: dueDate || null, status });
      }}
      className="flex flex-col gap-3 rounded border border-line p-4"
    >
      <input
        required
        placeholder="Deliverable title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={inputClass}
      />
      <div className="grid grid-cols-3 gap-3">
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        <select value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)} className={inputClass}>
          {DELIVERABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DELIVERABLE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn btn-primary !py-1.5"
        >
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
