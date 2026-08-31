"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DealStage } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/features/deals/display";

const inputClass =
  "input";

export interface EditableDeal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  ownerId: string | null;
  notes: string;
  expectedCloseDate: string; // YYYY-MM-DD or ""
}

export function DealEditor({
  deal,
  members,
  writable,
}: {
  deal: EditableDeal;
  members: { id: string; name: string | null; email: string }[];
  writable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(deal);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const readonly = !writable;

  function set<K extends keyof EditableDeal>(k: K, v: EditableDeal[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          value: form.value,
          stage: form.stage,
          ownerId: form.ownerId || null,
          notes: form.notes || null,
          expectedCloseDate: form.expectedCloseDate || null,
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
    if (!confirm(`Delete deal "${form.title}"?`)) return;
    setPending(true);
    try {
      await apiFetch(`/api/deals/${deal.id}`, { method: "DELETE" });
      router.back();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete.");
      setPending(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Field label="Title">
        <input value={form.title} disabled={readonly} onChange={(e) => set("title", e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Value ($)">
          <input type="number" min="0" value={form.value} disabled={readonly} onChange={(e) => set("value", Number(e.target.value) || 0)} className={inputClass} />
        </Field>
        <Field label="Stage">
          <select value={form.stage} disabled={readonly} onChange={(e) => set("stage", e.target.value as DealStage)} className={inputClass}>
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Owner">
          <select value={form.ownerId ?? ""} disabled={readonly} onChange={(e) => set("ownerId", e.target.value || null)} className={inputClass}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Expected close">
          <input type="date" value={form.expectedCloseDate} disabled={readonly} onChange={(e) => set("expectedCloseDate", e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={3} value={form.notes} disabled={readonly} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      {writable && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button onClick={onDelete} disabled={pending} className="btn btn-danger">
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
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
