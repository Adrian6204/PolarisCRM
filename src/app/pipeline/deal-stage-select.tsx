"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DealStage } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/features/deals/display";

/**
 * Inline stage picker for a deal card. PATCHes the stage and refreshes so the
 * board re-buckets. Moving to "won" promotes a prospect client server-side.
 */
export function DealStageSelect({
  dealId,
  stage,
  disabled,
}: {
  dealId: string;
  stage: DealStage;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [saving, setSaving] = useState(false);

  async function onChange(next: DealStage) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: next }),
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
      onChange={(e) => onChange(e.target.value as DealStage)}
      className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs disabled:opacity-60 dark:border-gray-700"
    >
      {DEAL_STAGES.map((s) => (
        <option key={s} value={s}>
          {DEAL_STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
