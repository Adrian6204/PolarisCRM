"use client";

import { useState } from "react";
import { AppointmentStatus } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { SimpleSelect } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { APPOINTMENT_STATUS_LABELS, formatTime } from "@/features/appointments/display";
import type { AppointmentVM, HostVM, ClientVM } from "./calendar-view";

const NONE = "__none";

const STATUSES = Object.values(AppointmentStatus);
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const durationBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

/**
 * Create/edit dialog for an appointment. Scheduling is date + start time +
 * duration; a slot finder queries the host's availability and fills the time.
 */
export function AppointmentDialog({
  hosts,
  clients,
  durations,
  initial,
  defaultDate,
  defaultClientId,
  onClose,
  onSaved,
}: {
  hosts: HostVM[];
  clients: ClientVM[];
  durations: number[];
  initial?: AppointmentVM;
  defaultDate?: string;
  defaultClientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial;
  const confirm = useConfirm();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? hosts[0]?.id ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? "");
  const [contactId, setContactId] = useState(initial?.contactId ?? "");
  const [date, setDate] = useState(initial ? localDate(initial.startAt) : defaultDate ?? todayIso);
  const [time, setTime] = useState(initial ? localTime(initial.startAt) : "09:00");
  const [duration, setDuration] = useState(initial ? durationBetween(initial.startAt, initial.endAt) : 30);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status ?? AppointmentStatus.scheduled);

  const [slots, setSlots] = useState<{ startAt: string; endAt: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contacts = clients.find((c) => c.id === clientId)?.contacts ?? [];

  async function findSlots() {
    setError(null);
    setSlots(null);
    if (!ownerId || !date) return;
    try {
      const found = await apiFetch<{ startAt: string; endAt: string }[]>(
        `/api/availability/slots?userId=${ownerId}&date=${date}&duration=${duration}`,
      );
      setSlots(found);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load slots.");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const startAt = new Date(`${date}T${time}`);
      const endAt = new Date(startAt.getTime() + duration * 60000);
      const body = {
        title,
        ownerId,
        clientId: clientId || null,
        contactId: contactId || null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: location || null,
        notes: notes || null,
        ...(editing ? { status } : {}),
      };
      if (editing) {
        await apiFetch(`/api/appointments/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/appointments", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !(await confirm({ title: "Delete this appointment?", confirmLabel: "Delete", destructive: true }))) return;
    setBusy(true);
    try {
      await apiFetch(`/api/appointments/${initial.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{editing ? "Edit appointment" : "New appointment"}</h2>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Discovery call" className="input" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Host</span>
            <SimpleSelect
              value={ownerId}
              onValueChange={(v) => { setOwnerId(v); setSlots(null); }}
              aria-label="Host"
              options={hosts.map((h) => ({ value: h.id, label: h.name ?? h.email }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Client</span>
            <SimpleSelect
              value={clientId || NONE}
              onValueChange={(v) => { setClientId(v === NONE ? "" : v); setContactId(""); }}
              aria-label="Client"
              options={[{ value: NONE, label: "None" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </label>
        </div>

        {contacts.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Contact</span>
            <SimpleSelect
              value={contactId || NONE}
              onValueChange={(v) => setContactId(v === NONE ? "" : v)}
              aria-label="Contact"
              options={[{ value: NONE, label: "None" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </label>
        )}

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Date</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlots(null); }} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Start</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Duration</span>
            <SimpleSelect
              value={String(duration)}
              onValueChange={(v) => { setDuration(Number(v)); setSlots(null); }}
              aria-label="Duration"
              options={durations.map((d) => ({ value: String(d), label: `${d} min` }))}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-line p-3">
          <button type="button" onClick={findSlots} className="text-sm link hover:underline self-start">
            Find available slots
          </button>
          {slots && (
            slots.length === 0 ? (
              <p className="text-xs text-muted">No open slots — check the host&rsquo;s availability in Settings.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const t = localTime(s.startAt);
                  const active = t === time;
                  return (
                    <button
                      key={s.startAt}
                      type="button"
                      onClick={() => setTime(t)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-fg bg-surface2 font-medium" : "border-line hover:border-line-strong"}`}
                    >
                      {formatTime(s.startAt)}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zoom / office" className="input" />
          </label>
          {editing && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Status</span>
              <SimpleSelect
                value={status}
                onValueChange={(v) => setStatus(v as AppointmentStatus)}
                aria-label="Status"
                options={STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_LABELS[s] }))}
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy || !title.trim() || !ownerId} className="btn btn-primary">
              {busy ? "Saving…" : editing ? "Save" : "Schedule"}
            </button>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
          {editing && (
            <button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:underline dark:text-red-400">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
