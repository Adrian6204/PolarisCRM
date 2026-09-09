"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";

const STATUSES = ["", "active", "prospect", "past"] as const;
// Radix Select forbids empty-string item values; use a sentinel for "All".
const ALL = "__all";

/**
 * Search + status filter for the client list. Writes state into the URL query
 * (debounced search) so the server component re-renders with fresh data.
 */
export function ClientControls({
  initialQ,
  initialStatus,
  initialTagId,
  tags,
}: {
  initialQ: string;
  initialStatus: string;
  initialTagId: string;
  tags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();

  function apply(next: { q?: string; status?: string; tagId?: string }) {
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
      <SimpleSelect
        value={initialStatus || ALL}
        onValueChange={(v) => apply({ status: v === ALL ? "" : v })}
        aria-label="Filter by status"
        className="w-40"
        options={[
          { value: ALL, label: "All statuses" },
          ...STATUSES.filter(Boolean).map((s) => ({ value: s, label: s })),
        ]}
      />
      {tags.length > 0 && (
        <SimpleSelect
          value={initialTagId || ALL}
          onValueChange={(v) => apply({ tagId: v === ALL ? "" : v })}
          aria-label="Filter by tag"
          className="w-44"
          options={[{ value: ALL, label: "All tags" }, ...tags.map((t) => ({ value: t.id, label: t.name }))]}
        />
      )}
    </div>
  );
}
