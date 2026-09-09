"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutomationTrigger, AutomationActionType, ActivityType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
import { TRIGGER_LABELS, ACTION_LABELS, TRIGGER_TOKENS } from "@/features/automations/display";

const ALWAYS = "__always";

interface ActionV { type: AutomationActionType; config: Record<string, unknown> }
interface AutomationV {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  active: boolean;
  conditions: Record<string, string> | null;
  actions: ActionV[];
}
interface RunV { id: string; name: string; status: string; detail: string | null; at: string }

const TRIGGERS = Object.values(AutomationTrigger);
const ACTION_TYPES = Object.values(AutomationActionType);
const ACTIVITY_TYPES = Object.values(ActivityType);

function actionSummary(a: ActionV): string {
  if (a.type === AutomationActionType.add_tag) return `Add tag "${a.config.tag}"`;
  if (a.type === AutomationActionType.create_note) return `Create note: ${String(a.config.body).slice(0, 40)}…`;
  return `Log ${a.config.type ?? "note"}: ${String(a.config.summary).slice(0, 40)}…`;
}

export function AutomationsManager({
  isAdmin,
  initial,
  runs,
}: {
  isAdmin: boolean;
  initial: AutomationV[];
  runs: RunV[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
        <div>
          {showForm ? (
            <CreateForm
              onCancel={() => setShowForm(false)}
              onCreate={(body) => run(async () => {
                await apiFetch("/api/automations", { method: "POST", body: JSON.stringify(body) });
                setShowForm(false);
              })}
            />
          ) : (
            <button onClick={() => setShowForm(true)} className="btn btn-primary !py-1.5">New automation</button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {initial.length === 0 ? (
        <p className="empty">No automations yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.map((a) => (
            <li key={a.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.active ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-surface2 text-muted"}`}>
                    {a.active ? "Active" : "Paused"}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => run(() => apiFetch(`/api/automations/${a.id}`, { method: "PATCH", body: JSON.stringify({ active: !a.active }) }))} className="link hover:underline">
                      {a.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete automation "${a.name}"?`)) run(() => apiFetch(`/api/automations/${a.id}`, { method: "DELETE" })); }}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted">
                <span className="font-medium text-fg">When</span> {TRIGGER_LABELS[a.trigger]}
                {a.conditions && Object.keys(a.conditions).length > 0 && (
                  <> <span className="font-medium text-fg">if</span> {Object.entries(a.conditions).map(([k, v]) => `${k} = ${v}`).join(", ")}</>
                )}
                {" → "}
                {a.actions.map(actionSummary).join("; ")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.name}</span>
                  {r.detail && <span className="truncate text-xs text-muted">{r.detail}</span>}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                  <span className={r.status === "error" ? "text-red-600 dark:text-red-400" : r.status === "success" ? "text-green-600 dark:text-green-400" : ""}>
                    {r.status}
                  </span>
                  <time dateTime={r.at}>{new Date(r.at).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (body: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>(AutomationTrigger.deal_won);
  const [condKey, setCondKey] = useState("");
  const [condValue, setCondValue] = useState("");
  const [actions, setActions] = useState<ActionV[]>([{ type: AutomationActionType.add_tag, config: { tag: "" } }]);

  const tokens = TRIGGER_TOKENS[trigger];

  function setAction(i: number, patch: Partial<ActionV>) {
    setActions((as) => as.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function setActionType(i: number, type: AutomationActionType) {
    const config =
      type === AutomationActionType.add_tag ? { tag: "" }
      : type === AutomationActionType.create_note ? { body: "" }
      : { summary: "", activityType: ActivityType.note };
    setAction(i, { type, config });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const conditions = condKey && condValue ? { [condKey]: condValue } : undefined;
    // Flatten each action's config into the flat, type-discriminated shape the API expects.
    const flatActions = actions.map((a) => {
      if (a.type === AutomationActionType.add_tag) return { type: a.type, tag: String(a.config.tag ?? "") };
      if (a.type === AutomationActionType.create_note) return { type: a.type, body: String(a.config.body ?? "") };
      return { type: a.type, summary: String(a.config.summary ?? ""), activityType: String(a.config.activityType ?? ActivityType.note) };
    });
    onCreate({ name: name.trim(), trigger, conditions, active: true, actions: flatActions });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold">New automation</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag won deals" className="input" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">When (trigger)</span>
          <SimpleSelect
            value={trigger}
            onValueChange={(v) => { setTrigger(v as AutomationTrigger); setCondKey(""); }}
            aria-label="Trigger"
            options={TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABELS[t] }))}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Condition (optional)</span>
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            value={condKey || ALWAYS}
            onValueChange={(v) => setCondKey(v === ALWAYS ? "" : v)}
            aria-label="Condition field"
            className="w-44"
            options={[{ value: ALWAYS, label: "Always" }, ...tokens.map((t) => ({ value: t, label: t }))]}
          />
          {condKey && (
            <>
              <span className="text-muted">=</span>
              <input value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder="value" className="input !w-40" />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">Actions</span>
        <p className="text-xs text-muted">Tokens: {tokens.map((t) => `{{${t}}}`).join(" ")}</p>
        {actions.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2">
            <SimpleSelect
              value={a.type}
              onValueChange={(v) => setActionType(i, v as AutomationActionType)}
              aria-label="Action"
              className="w-40"
              options={ACTION_TYPES.map((t) => ({ value: t, label: ACTION_LABELS[t] }))}
            />
            {a.type === AutomationActionType.add_tag && (
              <input value={String(a.config.tag ?? "")} onChange={(e) => setAction(i, { config: { tag: e.target.value } })} placeholder="Tag name" className="input !w-48" />
            )}
            {a.type === AutomationActionType.create_note && (
              <input value={String(a.config.body ?? "")} onChange={(e) => setAction(i, { config: { body: e.target.value } })} placeholder="Note body" className="input flex-1 !min-w-48" />
            )}
            {a.type === AutomationActionType.log_activity && (
              <>
                <SimpleSelect
                  value={String(a.config.activityType ?? ActivityType.note)}
                  onValueChange={(v) => setAction(i, { config: { ...a.config, activityType: v } })}
                  aria-label="Activity type"
                  className="w-32"
                  options={ACTIVITY_TYPES.map((t) => ({ value: t, label: t }))}
                />
                <input value={String(a.config.summary ?? "")} onChange={(e) => setAction(i, { config: { ...a.config, summary: e.target.value } })} placeholder="Summary" className="input flex-1 !min-w-40" />
              </>
            )}
            {actions.length > 1 && (
              <button type="button" onClick={() => setActions((as) => as.filter((_, idx) => idx !== i))} className="px-1 text-red-600 hover:underline dark:text-red-400" aria-label="Remove action">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setActions((as) => [...as, { type: AutomationActionType.add_tag, config: { tag: "" } }])} className="self-start text-xs link hover:underline">
          + Add action
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!name.trim()} className="btn btn-primary !py-1.5">Create</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
      </div>
    </form>
  );
}
