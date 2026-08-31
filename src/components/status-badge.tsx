import type { ClientStatus } from "@prisma/client";

const STYLES: Record<ClientStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  prospect: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  past: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
