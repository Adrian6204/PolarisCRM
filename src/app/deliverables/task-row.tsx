"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeliverableStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import {
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABELS,
} from "@/features/deliverables/status";

export interface TaskRowData {
  id: string;
  title: string;
  status: DeliverableStatus;
  dueDate: string | null;
  owner: { name: string | null; email: string } | null;
  project: { id: string; name: string };
}

/** One row in the global task list, with an inline (fast) status change. */
export function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const overdue =
    task.dueDate &&
    task.status !== DeliverableStatus.done &&
    new Date(task.dueDate) < new Date();

  async function onStatus(next: DeliverableStatus) {
    try {
      await apiFetch(`/api/deliverables/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Failed to update.");
    }
  }

  return (
    <tr className="border-b border-line last:border-0 transition-colors hover:bg-surface">
      <td className="px-4 py-3 font-medium">{task.title}</td>
      <td className="px-4 py-3 text-muted">
        <Link href={`/projects/${task.project.id}`} className="hover:underline">
          {task.project.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted">
        {task.owner ? (task.owner.name ?? task.owner.email) : "—"}
      </td>
      <td className={`px-4 py-3 ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted"}`}>
        {task.dueDate ?? "—"}
      </td>
      <td className="px-4 py-3">
        <select
          value={task.status}
          onChange={(e) => onStatus(e.target.value as DeliverableStatus)}
          className="rounded border border-line bg-transparent px-1.5 py-1 text-xs"
        >
          {DELIVERABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DELIVERABLE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
