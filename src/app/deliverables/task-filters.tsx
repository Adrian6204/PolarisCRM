"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DeliverableStatus } from "@prisma/client";
import {
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABELS,
} from "@/features/deliverables/status";

/** Status + owner filters for the global task list; state lives in the URL. */
export function TaskFilters({
  members,
  currentUserId,
}: {
  members: { id: string; name: string | null; email: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/deliverables?${params.toString()}`);
  }

  const status = searchParams.get("status") ?? "";
  const ownerId = searchParams.get("ownerId") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">All statuses</option>
        {DELIVERABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DELIVERABLE_STATUS_LABELS[s as DeliverableStatus]}
          </option>
        ))}
      </select>

      <select
        value={ownerId}
        onChange={(e) => apply({ ownerId: e.target.value })}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">All owners</option>
        <option value={currentUserId}>Assigned to me</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
    </div>
  );
}
