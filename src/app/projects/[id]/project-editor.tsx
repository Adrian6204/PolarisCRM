"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ServiceType, EngagementType, ProjectStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { stagesFor, stageLabel } from "@/features/projects/stages";

const inputClass =
  "rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

export interface EditableProject {
  id: string;
  name: string;
  serviceType: ServiceType;
  engagementType: EngagementType;
  stage: string;
  status: ProjectStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  retainerRenewalDate: string;
}

/**
 * Inline editor for the mutable parts of a project (name, stage, status,
 * dates). Service/engagement type are immutable and shown read-only on the
 * detail page. Sends one PATCH with the edited fields; the server re-validates
 * stage against the project's service/engagement type.
 */
export function ProjectEditor({
  project,
  writable,
}: {
  project: EditableProject;
  writable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(project);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const stages = stagesFor(project.serviceType, project.engagementType);
  const isRetainer = project.engagementType === EngagementType.retainer;

  function set<K extends keyof EditableProject>(key: K, value: EditableProject[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          stage: form.stage,
          status: form.status,
          startDate: form.startDate,
          endDate: form.endDate || null,
          retainerRenewalDate: isRetainer && form.retainerRenewalDate ? form.retainerRenewalDate : null,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete project "${form.name}"? It can be restored by an admin.`)) return;
    setPending(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete.");
      setPending(false);
    }
  }

  const readonly = !writable;

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Field label="Name">
        <input value={form.name} disabled={readonly} onChange={(e) => set("name", e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stage">
          <select value={form.stage} disabled={readonly} onChange={(e) => set("stage", e.target.value)} className={inputClass}>
            {stages.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            disabled={readonly}
            onChange={(e) => set("status", e.target.value as ProjectStatus)}
            className={inputClass}
          >
            <option value={ProjectStatus.active}>Active</option>
            <option value={ProjectStatus.on_hold}>On hold</option>
            <option value={ProjectStatus.completed}>Completed</option>
            <option value={ProjectStatus.cancelled}>Cancelled</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date">
          <input type="date" value={form.startDate} disabled={readonly} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
        </Field>
        <Field label="End date">
          <input type="date" value={form.endDate} disabled={readonly} onChange={(e) => set("endDate", e.target.value)} className={inputClass} />
        </Field>
      </div>

      {isRetainer && (
        <Field label="Retainer renewal date">
          <input
            type="date"
            value={form.retainerRenewalDate}
            disabled={readonly}
            onChange={(e) => set("retainerRenewalDate", e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      {writable && (
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={pending}
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}
