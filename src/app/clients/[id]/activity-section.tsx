"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";

const TYPE_META: Record<ActivityType, { label: string; icon: string; badge: string }> = {
  call: { label: "Call", icon: "📞", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  email: { label: "Email", icon: "✉️", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  meeting: { label: "Meeting", icon: "🤝", badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  note: { label: "Note", icon: "📝", badge: "bg-surface2 text-fg " },
};
const TYPES = Object.keys(TYPE_META) as ActivityType[];

export interface ActivityView {
  id: string;
  type: ActivityType;
  summary: string;
  createdAt: string; // ISO
  createdBy: { name: string | null; email: string } | null;
  project: { id: string; name: string } | null;
}

/**
 * Chronological activity feed for a client + a quick-add form for logging
 * calls/emails/meetings/notes (Phase 4). Any signed-in user can log; writers
 * can delete erroneous entries.
 */
export function ActivitySection({
  clientId,
  activities,
  projects,
  writable,
}: {
  clientId: string;
  activities: ActivityView[];
  projects: { id: string; name: string }[];
  writable: boolean;
}) {
  const router = useRouter();
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

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Activity</h2>

      <QuickAddForm
        projects={projects}
        onSubmit={(values) =>
          run(() =>
            apiFetch(`/api/clients/${clientId}/activities`, {
              method: "POST",
              body: JSON.stringify(values),
            }),
          )
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {activities.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No activity logged yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {activities.map((a) => {
            const meta = TYPE_META[a.type];
            return (
              <li key={a.id} className="flex gap-3">
                <div className="mt-0.5 text-lg" aria-hidden>
                  {meta.icon}
                </div>
                <div className="flex flex-1 flex-col gap-1 border-b border-line pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time>
                      {writable && (
                        <button
                          onClick={() => {
                            if (!confirm("Delete this activity entry?")) return;
                            run(() => apiFetch(`/api/activities/${a.id}`, { method: "DELETE" }));
                          }}
                          className="text-red-600 hover:underline dark:text-red-400"
                          aria-label="Delete activity"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{a.summary}</p>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                    <span>{a.createdBy ? (a.createdBy.name ?? a.createdBy.email) : "Unknown"}</span>
                    {a.project && (
                      <>
                        <span>·</span>
                        <Link href={`/projects/${a.project.id}`} className="hover:underline">
                          {a.project.name}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function QuickAddForm({
  projects,
  onSubmit,
}: {
  projects: { id: string; name: string }[];
  onSubmit: (values: { type: ActivityType; summary: string; projectId: string | null }) => void;
}) {
  const [type, setType] = useState<ActivityType>(ActivityType.note);
  const [summary, setSummary] = useState("");
  const [projectId, setProjectId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!summary.trim()) return;
        onSubmit({ type, summary, projectId: projectId || null });
        setSummary("");
      }}
      className="flex flex-col gap-3 rounded border border-line p-4"
    >
      <textarea
        required
        rows={2}
        placeholder="Log a call, email, meeting or note…"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select value={type} onChange={(e) => setType(e.target.value as ActivityType)} className={inputClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
          <option value="">Client-level (no project)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn btn-primary !py-1.5"
        >
          Log activity
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "input";
