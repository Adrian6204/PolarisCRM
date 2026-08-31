"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const STATUSES = ["", "active", "prospect", "past"] as const;

/**
 * Search + status filter for the client list. Writes state into the URL query
 * (debounced search) so the server component re-renders with fresh data.
 */
export function ClientControls({
  initialQ,
  initialStatus,
}: {
  initialQ: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();

  function apply(next: { q?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Reset to page 1 whenever filters change.
    params.delete("page");
    startTransition(() => router.push(`/clients?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Search by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply({ q })}
        onBlur={() => apply({ q })}
        className="w-64 input"
      />
      <select
        value={initialStatus}
        onChange={(e) => apply({ status: e.target.value })}
        className="input"
      >
        {STATUSES.map((s) => (
          <option key={s || "all"} value={s}>
            {s === "" ? "All statuses" : s}
          </option>
        ))}
      </select>
    </div>
  );
}
