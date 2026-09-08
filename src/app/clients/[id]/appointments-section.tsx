"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppointmentDialog } from "@/app/calendar/appointment-dialog";
import type { AppointmentVM, HostVM, ClientVM } from "@/app/calendar/calendar-view";
import { DURATION_OPTIONS, APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES, formatTime } from "@/features/appointments/display";

/**
 * Appointments for a single client, shown on its detail page: upcoming first,
 * with a Schedule button that opens the calendar dialog pre-linked to the client.
 */
export function AppointmentsSection({
  client,
  hosts,
  appointments,
  writable,
}: {
  client: ClientVM;
  hosts: HostVM[];
  appointments: AppointmentVM[];
  writable: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AppointmentVM | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Appointments</h2>
        {writable && (
          <button onClick={() => setCreating(true)} className="text-sm link hover:underline">
            + Schedule
          </button>
        )}
      </div>

      {appointments.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No appointments scheduled.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {appointments.map((a) => {
            const start = new Date(a.startAt);
            return (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex flex-col">
                  <button
                    onClick={() => writable && setEditing(a)}
                    className={`text-left font-medium ${writable ? "hover:underline" : "cursor-default"}`}
                  >
                    {a.title}
                  </button>
                  <span className="text-sm text-muted">
                    {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatTime(a.startAt)} · {a.ownerName}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${APPOINTMENT_STATUS_STYLES[a.status]}`}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <AppointmentDialog
          hosts={hosts}
          clients={[client]}
          durations={[...DURATION_OPTIONS]}
          initial={editing ?? undefined}
          defaultClientId={client.id}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); router.refresh(); }}
        />
      )}
    </section>
  );
}
