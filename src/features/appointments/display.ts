import { AppointmentStatus } from "@prisma/client";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-400",
  no_show: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

/** Common slot lengths offered in the booking UI (minutes). */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** e.g. "9:30 AM". */
export function formatTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso));
}

/** Minutes-from-midnight → "HH:MM" for <input type=time> and display. */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutes from midnight. */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
