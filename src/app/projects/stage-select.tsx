"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ServiceType, EngagementType } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { stagesFor, stageLabel } from "@/features/projects/stages";

/**
 * Inline stage picker for a project. PATCHes the project's stage and refreshes
 * so the board re-buckets the card. Options are the valid stages for the
 * project's own service/engagement type (the server re-validates regardless).
 */
export function StageSelect({
  projectId,
  serviceType,
  engagementType,
  stage,
  disabled,
}: {
  projectId: string;
  serviceType: ServiceType;
  engagementType: EngagementType;
  stage: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [saving, setSaving] = useState(false);
  const options = stagesFor(serviceType, engagementType);

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: next }),
      });
      router.refresh();
    } catch (err) {
      setValue(prev); // revert on failure
      alert(err instanceof ApiClientError ? err.message : "Failed to update stage.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={disabled || saving}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-line bg-transparent px-1.5 py-1 text-xs disabled:opacity-60"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {stageLabel(s)}
        </option>
      ))}
    </select>
  );
}
