"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

type ClientStatus = "active" | "prospect" | "past";

export interface ClientFormValues {
  id?: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  status: ClientStatus;
}

const STATUSES: ClientStatus[] = ["prospect", "active", "past"];

/**
 * Create/edit form for a client. POSTs to /api/clients (create) or PATCHes
 * /api/clients/:id (edit), then navigates to the detail page. Server-side
 * validation errors surface inline.
 */
export function ClientForm({ initial }: { initial?: ClientFormValues }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [status, setStatus] = useState<ClientStatus>(initial?.status ?? "prospect");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = { name, industry, website, status };
    try {
      const client = editing
        ? await apiFetch<{ id: string }>(`/api/clients/${initial!.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ id: string }>("/api/clients", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Something went wrong.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <Field label="Name" required>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Industry">
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Website">
        <input
          type="url"
          placeholder="https://…"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClientStatus)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Create client"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600 dark:text-gray-400">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
