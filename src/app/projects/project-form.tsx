"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ServiceType, EngagementType, ProjectStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
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
        <SimpleSelect
          value={clientId}
          onValueChange={setClientId}
          aria-label="Client"
          placeholder="No clients — create one first"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>

      <Field label="Name" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Service type">
          <SimpleSelect
            value={serviceType}
            onValueChange={(v) => { setServiceType(v as ServiceType); setStage(""); }}
            aria-label="Service type"
            options={SERVICE_TYPES.map((s) => ({ value: s, label: serviceTypeLabel(s) }))}
          />
        </Field>
        <Field label="Engagement">
          <SimpleSelect
            value={engagementType}
            onValueChange={(v) => { setEngagementType(v as EngagementType); setStage(""); }}
            aria-label="Engagement"
            options={[
              { value: EngagementType.one_off, label: "One-off" },
              { value: EngagementType.retainer, label: "Retainer" },
            ]}
          />
        </Field>
      </div>

      <Field label="Starting stage">
        <SimpleSelect
          value={effectiveStage}
          onValueChange={setStage}
          aria-label="Starting stage"
          options={stages.map((s) => ({ value: s, label: stageLabel(s) }))}
        />
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
        <SimpleSelect
          value={status}
          onValueChange={(v) => setStatus(v as ProjectStatus)}
          aria-label="Status"
          options={[
            { value: ProjectStatus.active, label: "Active" },
            { value: ProjectStatus.on_hold, label: "On hold" },
            { value: ProjectStatus.completed, label: "Completed" },
            { value: ProjectStatus.cancelled, label: "Cancelled" },
          ]}
        />
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
