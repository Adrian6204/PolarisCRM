"use client";

import { useRouter } from "next/navigation";
import type { ServiceType } from "@prisma/client";
import { SERVICE_TYPES, serviceTypeLabel } from "@/features/projects/stages";

/** Service-type selector for the board; drives the ?serviceType= query param. */
export function ServiceTabs({ active }: { active: ServiceType }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
      {SERVICE_TYPES.map((s) => {
        const isActive = s === active;
        return (
          <button
            key={s}
            onClick={() => router.push(`/projects?serviceType=${s}`)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {serviceTypeLabel(s)}
          </button>
        );
      })}
    </div>
  );
}
