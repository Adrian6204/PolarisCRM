"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
import type { TimelineEvent } from "@/features/timeline/service";

const NO_PROJECT = "__none";

const ACT_LABEL: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};
const ACT_TYPES = Object.keys(ACT_LABEL) as ActivityType[];

/**
 * Unified client timeline (GHL contact history): activities + notes interleaved
 * newest-first, with a composer that toggles between logging an activity and
 * adding a note. Any signed-in user can add; writers can delete entries.
 */
export function TimelineSection({
  clientId,
  events,
  projects,
  writable,
}: {
  clientId: string;
  events: TimelineEvent[];
  projects: { id: string; name: string }[];
  writable: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"activity" | "note">("activity");
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
      <h2 className="text-lg font-semibold">Timeline</h2>

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex gap-1 rounded-md bg-surface2 p-0.5 text-sm" role="tablist">
          {(["activity", "note"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded px-3 py-1.5 font-medium capitalize transition-colors ${
                mode === m ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {m === "activity" ? "Log activity" : "Note"}
            </button>
          ))}
        </div>

        {mode === "activity" ? (
          <ActivityComposer
            projects={projects}
            onSubmit={(v) =>
              run(() => apiFetch(`/api/clients/${clientId}/activities`, { method: "POST", body: JSON.stringify(v) }))
            }
          />
        ) : (
          <NoteComposer
            onSubmit={(body) =>
              run(() => apiFetch(`/api/clients/${clientId}/notes`, { method: "POST", body: JSON.stringify({ body }) }))
            }
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {events.length === 0 ? (
        <p className="empty">No history yet — log an activity or add a note.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="flex gap-3">
              {/* rail */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: e.kind === "note" ? "var(--chart-warn)" : "var(--chart-ink)" }}
                  aria-hidden
                />
                <span className="w-px flex-1 bg-line" aria-hidden />
              </div>

              <div className="flex-1 pb-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">
                    {e.kind === "note" ? "Note" : ACT_LABEL[e.activityType]}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
                    {writable && (
                      <button
                        onClick={() => {
                          if (!confirm("Delete this entry?")) return;
                          const url = e.kind === "note" ? `/api/notes/${e.id}` : `/api/activities/${e.id}`;
                          run(() => apiFetch(url, { method: "DELETE" }));
                        }}
                        className="text-red-600 hover:underline dark:text-red-400"
                        aria-label="Delete entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {e.kind === "note" ? e.body : e.summary}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{e.actor ?? "Unknown"}</span>
                  {e.kind === "activity" && e.project && (
                    <>
                      <span>·</span>
                      <Link href={`/projects/${e.project.id}`} className="hover:underline">
                        {e.project.name}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityComposer({
  projects,
  onSubmit,
}: {
  projects: { id: string; name: string }[];
  onSubmit: (v: { type: ActivityType; summary: string; projectId: string | null }) => void;
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
      className="flex flex-col gap-3"
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
        <SimpleSelect
          value={type}
          onValueChange={(v) => setType(v as ActivityType)}
          aria-label="Activity type"
          className="w-36"
          options={ACT_TYPES.map((t) => ({ value: t, label: ACT_LABEL[t] }))}
        />
        <SimpleSelect
          value={projectId || NO_PROJECT}
          onValueChange={(v) => setProjectId(v === NO_PROJECT ? "" : v)}
          aria-label="Project"
          className="w-56"
          options={[{ value: NO_PROJECT, label: "Client-level (no project)" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <button type="submit" className="btn btn-primary !py-1.5">Log activity</button>
      </div>
    </form>
  );
}

function NoteComposer({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        onSubmit(body);
        setBody("");
      }}
      className="flex flex-col gap-3"
    >
      <textarea
        required
        rows={2}
        placeholder="Write a note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="input"
      />
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary !py-1.5">Add note</button>
      </div>
    </form>
  );
}
