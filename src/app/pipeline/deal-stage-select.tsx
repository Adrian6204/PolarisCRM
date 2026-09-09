"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";

/**
 * Inline stage picker for a deal card. PATCHes the stageId and refreshes so the
 * board re-buckets. Moving to a `won` stage promotes a prospect client
 * server-side. Options are the deal's own pipeline stages.
 */
export function DealStageSelect({
  dealId,
  stageId,
  stages,
  disabled,
}: {
  dealId: string;
  stageId: string;
  stages: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(stageId);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: next }),
      });
      router.refresh();
    } catch (err) {
      setValue(prev);
      alert(err instanceof ApiClientError ? err.message : "Failed to update stage.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SimpleSelect
      value={value}
      disabled={disabled || saving}
      onValueChange={onChange}
      aria-label="Deal stage"
      className="h-8 text-xs"
      options={stages.map((s) => ({ value: s.id, label: s.name }))}
    />
  );
}
