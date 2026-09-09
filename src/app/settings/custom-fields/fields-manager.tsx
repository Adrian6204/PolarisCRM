"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomFieldType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";

interface Def {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  sortOrder: number;
  archived: boolean;
}

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Text",
  textarea: "Paragraph",
  number: "Number",
  date: "Date",
  boolean: "Yes / No",
  url: "URL",
  select: "Dropdown",
};
const TYPES = Object.keys(TYPE_LABEL) as CustomFieldType[];

/** Admin manager for custom-field definitions: create, edit, archive, delete. */
export function FieldsManager({ isAdmin, initialDefs }: { isAdmin: boolean; initialDefs: Def[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const active = initialDefs.filter((d) => !d.archived);
  const archived = initialDefs.filter((d) => d.archived);

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
      {isAdmin && <CreateForm onCreate={(body) => run(() => apiFetch("/api/custom-fields", { method: "POST", body: JSON.stringify(body) }))} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        {active.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No custom fields yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {active.map((d) => (
              <FieldRow key={d.id} def={d} isAdmin={isAdmin} run={run} />
            ))}
          </ul>
        )}
      </div>

      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Archived</h2>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {archived.map((d) => (
                <FieldRow key={d.id} def={d} isAdmin={isAdmin} run={run} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ def, isAdmin, run }: { def: Def; isAdmin: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(def.label);
  const [sortOrder, setSortOrder] = useState(String(def.sortOrder));
  const [options, setOptions] = useState(def.options.join("\n"));

  function save() {
    const body: Record<string, unknown> = { label: label.trim(), sortOrder: Number(sortOrder) || 0 };
    if (def.type === CustomFieldType.select) {
      body.options = options.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    run(() => apiFetch(`/api/custom-fields/${def.id}`, { method: "PATCH", body: JSON.stringify(body) }));
    setEditing(false);
  }

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{def.label}</span>
          <span className="text-xs text-muted">
            {TYPE_LABEL[def.type]} · <code className="font-mono-nums">{def.key}</code>
            {def.type === CustomFieldType.select && def.options.length > 0 && ` · ${def.options.length} options`}
          </span>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-3 text-sm">
            {!def.archived && (
              <button onClick={() => setEditing((v) => !v)} className="link hover:underline">
                {editing ? "Cancel" : "Edit"}
              </button>
            )}
            <button
              onClick={() => run(() => apiFetch(`/api/custom-fields/${def.id}`, { method: "PATCH", body: JSON.stringify({ archived: !def.archived }) }))}
              className="text-muted hover:text-fg"
            >
              {def.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              onClick={async () => {
                if (await confirm({ title: `Delete "${def.label}"?`, description: "This deletes the field and all its values. This cannot be undone.", confirmLabel: "Delete", destructive: true }))
                  run(() => apiFetch(`/api/custom-fields/${def.id}`, { method: "DELETE" }));
              }}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Label
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input !w-56" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Sort order
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input !w-24" />
            </label>
          </div>
          {def.type === CustomFieldType.select && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Options (one per line)
              <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} className="input" />
            </label>
          )}
          <div>
            <button onClick={save} disabled={!label.trim()} className="btn btn-primary !py-1.5">Save</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateForm({ onCreate }: { onCreate: (body: Record<string, unknown>) => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>(CustomFieldType.text);
  const [options, setOptions] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const body: Record<string, unknown> = { label: label.trim(), type };
    if (type === CustomFieldType.select) {
      body.options = options.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    onCreate(body);
    setLabel("");
    setOptions("");
    setType(CustomFieldType.text);
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold">New field</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Account manager" className="input !w-56" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Type
          <SimpleSelect
            value={type}
            onValueChange={(v) => setType(v as CustomFieldType)}
            aria-label="Field type"
            className="w-40"
            options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
        </label>
        <button type="submit" className="btn btn-primary !py-1.5">Add field</button>
      </div>
      {type === CustomFieldType.select && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Options (one per line)
          <textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Basic\nPro\nEnterprise"} className="input" />
        </label>
      )}
    </form>
  );
}
