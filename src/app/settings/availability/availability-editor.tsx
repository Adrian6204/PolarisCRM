"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { minToHHMM, hhmmToMin } from "@/features/appointments/display";

interface Rule { weekday: number; startMin: number; endMin: number }

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;

/** Editor for the current user's weekly availability windows. */
export function AvailabilityEditor({ initial }: { initial: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }
  function add(weekday: number) {
    setRules((rs) => [...rs, { weekday, startMin: DEFAULT_START, endMin: DEFAULT_END }]);
    setSaved(false);
  }
  function remove(i: number) {
    setRules((rs) => rs.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/availability", { method: "PUT", body: JSON.stringify({ rules }) });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const invalid = rules.some((r) => r.endMin <= r.startMin);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col divide-y divide-line">
        {WEEKDAYS.map((label, weekday) => {
          const dayRules = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === weekday);
          return (
            <div key={weekday} className="flex items-start gap-4 p-3">
              <span className="w-24 pt-1.5 text-sm font-medium">{label}</span>
              <div className="flex flex-1 flex-col gap-2">
                {dayRules.length === 0 && <span className="pt-1.5 text-sm text-muted">Unavailable</span>}
                {dayRules.map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={minToHHMM(r.startMin)} onChange={(e) => update(i, { startMin: hhmmToMin(e.target.value) })} className="input !w-32 !py-1 text-sm" />
                    <span className="text-muted">–</span>
                    <input type="time" value={minToHHMM(r.endMin)} onChange={(e) => update(i, { endMin: hhmmToMin(e.target.value) })} className="input !w-32 !py-1 text-sm" />
                    <button onClick={() => remove(i)} className="px-1 text-red-600 hover:underline dark:text-red-400" aria-label="Remove window">✕</button>
                  </div>
                ))}
                <button onClick={() => add(weekday)} className="self-start text-xs link hover:underline">
                  + Add window
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || invalid} className="btn btn-primary !py-1.5">
          {saving ? "Saving…" : "Save availability"}
        </button>
        {invalid && <span className="text-sm text-red-600">End time must be after start time.</span>}
        {saved && !invalid && <span className="text-sm text-muted">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
