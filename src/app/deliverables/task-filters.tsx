"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DeliverableStatus } from "@prisma/client";
import {
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABELS,
} from "@/features/deliverables/status";
import { SimpleSelect } from "@/components/ui/select";

const ALL = "__all";

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
      <SimpleSelect
        value={status || ALL}
        onValueChange={(v) => apply({ status: v === ALL ? "" : v })}
        aria-label="Filter by status"
        className="w-44"
        options={[
          { value: ALL, label: "All statuses" },
          ...DELIVERABLE_STATUSES.map((s) => ({ value: s, label: DELIVERABLE_STATUS_LABELS[s as DeliverableStatus] })),
        ]}
      />

      <SimpleSelect
        value={ownerId || ALL}
        onValueChange={(v) => apply({ ownerId: v === ALL ? "" : v })}
        aria-label="Filter by owner"
        className="w-48"
        options={[
          { value: ALL, label: "All owners" },
          { value: currentUserId, label: "Assigned to me" },
          ...members.filter((m) => m.id !== currentUserId).map((m) => ({ value: m.id, label: m.name ?? m.email })),
        ]}
      />
    </div>
  );
}
