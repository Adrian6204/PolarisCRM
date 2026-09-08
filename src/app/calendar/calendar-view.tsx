"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppointmentStatus } from "@prisma/client";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  DURATION_OPTIONS,
  formatTime,
} from "@/features/appointments/display";
import { AppointmentDialog } from "./appointment-dialog";

export interface AppointmentVM {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  ownerId: string;
  ownerName: string;
  clientId: string | null;
  clientName: string | null;
  contactId: string | null;
  location: string | null;
  notes: string | null;
}
export interface HostVM { id: string; name: string | null; email: string }
export interface ClientVM { id: string; name: string; contacts: { id: string; name: string }[] }

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView({
  weekStart,
  writable,
  hosts,
  clients,
  appointments,
}: {
  weekStart: string;
  writable: boolean;
  hosts: HostVM[];
  clients: ClientVM[];
  appointments: AppointmentVM[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AppointmentVM | null>(null);
  const [creating, setCreating] = useState<{ date?: string } | null>(null);

  const days = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [weekStart]);
  const today = iso(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentVM[]>();
    for (const a of appointments) {
      const key = iso(new Date(a.startAt));
      (map.get(key) ?? map.set(key, []).get(key)!).push(a);
    }
    for (const list of map.values()) list.sort((x, y) => (x.startAt < y.startAt ? -1 : 1));
    return map;
  }, [appointments]);

  function shiftWeek(deltaDays: number) {
    const s = days[0];
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + deltaDays);
    router.push(`/calendar?week=${iso(d)}`);
  }

  const rangeLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <span className="text-sm text-muted">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-7)} className="btn btn-secondary !py-1.5" aria-label="Previous week">←</button>
          <button onClick={() => router.push("/calendar")} className="btn btn-secondary !py-1.5">Today</button>
          <button onClick={() => shiftWeek(7)} className="btn btn-secondary !py-1.5" aria-label="Next week">→</button>
          {writable && (
            <button onClick={() => setCreating({})} className="btn btn-primary !py-1.5">New appointment</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, i) => {
          const key = iso(day);
          const list = byDay.get(key) ?? [];
          const isToday = key === today;
          return (
            <div key={key} className="flex flex-col gap-2">
              <div className={`flex items-baseline justify-between rounded-md px-2 py-1 ${isToday ? "bg-surface2" : ""}`}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{WEEKDAYS[i]}</span>
                <span className={`text-sm font-medium ${isToday ? "text-fg" : "text-muted"}`}>{day.getDate()}</span>
              </div>
              <div className="flex min-h-24 flex-col gap-1.5 rounded-lg bg-surface p-1.5">
                {list.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => writable && setEditing(a)}
                    className={`flex flex-col gap-0.5 rounded-md border border-line bg-bg p-2 text-left text-xs shadow-sm ${writable ? "hover:border-line-strong" : "cursor-default"}`}
                  >
                    <span className="font-medium">{formatTime(a.startAt)}</span>
                    <span className="truncate">{a.title}</span>
                    {a.clientName && <span className="truncate text-muted">{a.clientName}</span>}
                    <span className={`mt-0.5 inline-block w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium ${APPOINTMENT_STATUS_STYLES[a.status]}`}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </span>
                  </button>
                ))}
                {writable && (
                  <button
                    onClick={() => setCreating({ date: key })}
                    className="rounded-md border border-dashed border-line-strong py-1 text-xs text-muted hover:text-fg"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <AppointmentDialog
          hosts={hosts}
          clients={clients}
          durations={[...DURATION_OPTIONS]}
          initial={editing ?? undefined}
          defaultDate={creating?.date}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={() => { setCreating(null); setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
