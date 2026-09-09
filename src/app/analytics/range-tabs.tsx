"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "365d", label: "12 months" },
];

/** Preset date-range switcher for the performance report (URL-driven). */
export function RangeTabs({ active }: { active: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function pick(key: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", key);
    router.push(`/analytics?${next.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-md bg-surface2 p-0.5 text-sm">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => pick(r.key)}
          aria-pressed={active === r.key}
          className={`rounded px-3 py-1 font-medium transition-colors ${
            active === r.key ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
