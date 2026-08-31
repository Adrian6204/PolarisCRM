"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { serviceTypeLabel } from "@/features/projects/stages";
import type { ServiceType } from "@prisma/client";

export interface ReportView {
  id: string;
  period: string;
  notes: string | null;
  metrics: Record<string, string | number | boolean>;
  project: { id: string; name: string; serviceType: ServiceType };
}

/**
 * Per-client reporting manager (Phase 6). Lists monthly report entries grouped
 * by project and provides an upsert form (one report per project per period).
 * Metrics are free-form key/value pairs so each service type records what it
 * tracks.
 */
export function ReportsManager({
  reports,
  projects,
  writable,
}: {
  reports: ReportView[];
  projects: { id: string; name: string }[];
  writable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reports</h2>
        {writable && !adding && projects.length > 0 && (
          <button onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            + Add report
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <ReportForm
          projects={projects}
          onCancel={() => setAdding(false)}
          onSubmit={(projectId, body) =>
            run(async () => {
              await apiFetch(`/api/projects/${projectId}/reports`, {
                method: "POST",
                body: JSON.stringify(body),
              });
              setAdding(false);
            })
          }
        />
      )}

      {reports.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
          No reports yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium">{r.period}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {r.project.name} · {serviceTypeLabel(r.project.serviceType)}
                  </span>
                </div>
                {writable && (
                  <button
                    onClick={() => {
                      if (!confirm(`Delete the ${r.period} report for ${r.project.name}?`)) return;
                      run(() => apiFetch(`/api/reports/${r.id}`, { method: "DELETE" }));
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
              {Object.keys(r.metrics).length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  {Object.entries(r.metrics).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-gray-100 py-1 dark:border-gray-900">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="font-medium tabular-nums">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {r.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportForm({
  projects,
  onCancel,
  onSubmit,
}: {
  projects: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (
    projectId: string,
    body: { period: string; metrics: Record<string, string | number>; notes: string | null },
  ) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  function setRow(i: number, patch: Partial<{ key: string; value: string }>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function buildMetrics(): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const { key, value } of rows) {
      const k = key.trim();
      if (!k) continue;
      // Coerce numeric-looking values to numbers so they render/aggregate well.
      const num = Number(value);
      out[k] = value.trim() !== "" && !Number.isNaN(num) ? num : value;
    }
    return out;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!projectId) return;
        onSubmit(projectId, { period, metrics: buildMetrics(), notes: notes || null });
      }}
      className="flex flex-col gap-3 rounded border border-gray-200 p-4 dark:border-gray-800"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Project</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Period</span>
          <input type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Metrics</span>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input placeholder="Metric (e.g. organic_clicks)" value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} className={`${inputClass} flex-1`} />
            <input placeholder="Value" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} className={`${inputClass} w-32`} />
          </div>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, { key: "", value: "" }])} className="self-start text-xs text-blue-600 hover:underline dark:text-blue-400">
          + Add metric
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-600 dark:text-gray-400">Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300">
          Save report
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";
