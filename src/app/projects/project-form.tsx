"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ServiceType, EngagementType, ProjectStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import {
  SERVICE_TYPES,
  serviceTypeLabel,
  stagesFor,
  stageLabel,
} from "@/features/projects/stages";

const inputClass =
  "input";

/**
 * Create form for a project. Picks a client, service type and engagement type,
 * previews the resulting stage set, and POSTs to the client-scoped create
 * endpoint. Retainer renewal date is only shown for retainer engagements.
 */
export function ProjectForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.web_dev);
  const [engagementType, setEngagementType] = useState<EngagementType>(EngagementType.one_off);
  const [stage, setStage] = useState<string>("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [renewal, setRenewal] = useState("");
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Available stages track the selected service/engagement; default to first.
  const stages = useMemo(
    () => stagesFor(serviceType, engagementType),
    [serviceType, engagementType],
  );
  const effectiveStage = stage && stages.includes(stage) ? stage : stages[0]!;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const project = await apiFetch<{ id: string }>(
        `/api/clients/${clientId}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            serviceType,
            engagementType,
            stage: effectiveStage,
            startDate,
            endDate: endDate || null,
            retainerRenewalDate:
              engagementType === EngagementType.retainer && renewal ? renewal : null,
            status,
          }),
        },
      );
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <Field label="Client" required>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
          {clients.length === 0 && <option value="">No clients — create one first</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Service type">
          <select
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value as ServiceType);
              setStage(""); // reset — stage set changes with service type
            }}
            className={inputClass}
          >
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {serviceTypeLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Engagement">
          <select
            value={engagementType}
            onChange={(e) => {
              setEngagementType(e.target.value as EngagementType);
              setStage("");
            }}
            className={inputClass}
          >
            <option value={EngagementType.one_off}>One-off</option>
            <option value={EngagementType.retainer}>Retainer</option>
          </select>
        </Field>
      </div>

      <Field label="Starting stage">
        <select value={effectiveStage} onChange={(e) => setStage(e.target.value)} className={inputClass}>
          {stages.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" required>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="End date">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {engagementType === EngagementType.retainer && (
        <Field label="Retainer renewal date">
          <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} className={inputClass} />
        </Field>
      )}

      <Field label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputClass}>
          <option value={ProjectStatus.active}>Active</option>
          <option value={ProjectStatus.on_hold}>On hold</option>
          <option value={ProjectStatus.completed}>Completed</option>
          <option value={ProjectStatus.cancelled}>Cancelled</option>
        </select>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || clients.length === 0}
          className="btn btn-primary"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
