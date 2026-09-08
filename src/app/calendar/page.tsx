import { requirePageUser, canWrite } from "@/lib/session";
import { listAppointments } from "@/features/appointments/service";
import { prisma } from "@/lib/prisma";
import { CalendarView } from "./calendar-view";

/**
 * Calendar (G3): a week view of appointments across all hosts. Week is URL-
 * driven (?week=YYYY-MM-DD, Monday) so it's shareable. Writers can schedule,
 * reschedule, restatus and delete; a slot finder uses host availability.
 */
export const dynamic = "force-dynamic";

/** Monday 00:00 of the week containing `d` (local). */
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageUser();
  const writable = canWrite(user.role);
  const sp = await searchParams;

  const base = sp.week ? new Date(`${sp.week}T00:00:00`) : new Date();
  const weekStart = mondayOf(Number.isNaN(base.getTime()) ? new Date() : base);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [appointments, hosts, clients] = await Promise.all([
    listAppointments({ from: weekStart, to: weekEnd }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, contacts: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CalendarView
      weekStart={weekStart.toISOString()}
      writable={writable}
      hosts={hosts}
      clients={clients}
      appointments={appointments.map((a) => ({
        id: a.id,
        title: a.title,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        status: a.status,
        ownerId: a.ownerId,
        ownerName: a.owner.name ?? a.owner.email,
        clientId: a.clientId,
        clientName: a.client?.name ?? null,
        contactId: a.contactId,
        location: a.location,
        notes: a.notes,
      }))}
    />
  );
}
