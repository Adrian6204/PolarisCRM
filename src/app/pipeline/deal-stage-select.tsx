"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

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
    <select
      value={value}
      disabled={disabled || saving}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-line bg-transparent px-1.5 py-1 text-xs disabled:opacity-60"
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
