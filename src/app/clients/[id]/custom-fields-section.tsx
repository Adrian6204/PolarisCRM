"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomFieldType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
import type { ClientFieldView } from "@/features/custom-fields/service";

const UNSET = "__unset";

/**
 * Editable custom-field panel on the client detail page. Renders a typed input
 * per active definition and saves the whole set in one PUT. Read-only for
 * team members; writers get inputs + Save.
 */
export function CustomFieldsSection({
  clientId,
  fields,
  writable,
}: {
  clientId: string;
  fields: ClientFieldView[];
  writable: boolean;
}) {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.fieldId, f.value ?? ""])),
    [fields],
  );
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = fields.some((f) => (draft[f.fieldId] ?? "") !== (f.value ?? ""));

  function set(fieldId: string, value: string) {
    setDraft((d) => ({ ...d, [fieldId]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/clients/${clientId}/custom-fields`, {
        method: "PUT",
        body: JSON.stringify({
          values: fields.map((f) => ({ fieldId: f.fieldId, value: draft[f.fieldId] ?? "" })),
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Custom fields</h2>
        <Link href="/settings/custom-fields" className="text-sm link hover:underline">
          Manage fields
        </Link>
      </div>

      {fields.length === 0 ? (
        <p className="empty">
          No custom fields defined.{" "}
          <Link href="/settings/custom-fields" className="link hover:underline">
            Create one
          </Link>{" "}
          to capture extra client data.
        </p>
      ) : (
        <div className="card flex flex-col gap-4 p-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.fieldId} className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</dt>
                <dd>
                  {writable ? (
                    <FieldInput field={f} value={draft[f.fieldId] ?? ""} onChange={(v) => set(f.fieldId, v)} />
                  ) : (
                    <ReadValue field={f} value={f.value} />
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {writable && (
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={!dirty || saving} className="btn btn-primary !py-1.5">
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && !dirty && <span className="text-sm text-muted">Saved ✓</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ClientFieldView;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (field.type) {
    case CustomFieldType.textarea:
      return <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className="input" />;
    case CustomFieldType.number:
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="input" />;
    case CustomFieldType.date:
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input" />;
    case CustomFieldType.url:
      return <input type="url" placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} className="input" />;
    case CustomFieldType.boolean:
      return (
        <SimpleSelect
          value={value || UNSET}
          onValueChange={(v) => onChange(v === UNSET ? "" : v)}
          aria-label={field.label}
          options={[{ value: UNSET, label: "—" }, { value: "true", label: "Yes" }, { value: "false", label: "No" }]}
        />
      );
    case CustomFieldType.select:
      return (
        <SimpleSelect
          value={value || UNSET}
          onValueChange={(v) => onChange(v === UNSET ? "" : v)}
          aria-label={field.label}
          options={[{ value: UNSET, label: "—" }, ...field.options.map((o) => ({ value: o, label: o }))]}
        />
      );
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input" />;
  }
}

function ReadValue({ field, value }: { field: ClientFieldView; value: string | null }) {
  if (!value) return <span className="text-muted">—</span>;
  if (field.type === CustomFieldType.boolean) return <span>{value === "true" ? "Yes" : "No"}</span>;
  if (field.type === CustomFieldType.url)
    return (
      <a href={value} target="_blank" rel="noreferrer" className="link hover:underline">
        {value}
      </a>
    );
  return <span className="whitespace-pre-wrap">{value}</span>;
}
