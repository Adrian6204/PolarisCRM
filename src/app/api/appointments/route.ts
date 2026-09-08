import { Role, AppointmentStatus } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { createAppointmentSchema, listAppointments, createAppointment } from "@/features/appointments/service";

/**
 * /api/appointments
 *   GET  — appointments in a window (any authed user). Query: from, to (ISO),
 *          ownerId, clientId, status.
 *   POST — schedule an appointment (admin / project lead).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req }) => {
  await requireUser();
  const p = new URL(req.url).searchParams;
  const status = p.get("status");
  return ok(
    await listAppointments({
      from: p.get("from") ? new Date(p.get("from")!) : undefined,
      to: p.get("to") ? new Date(p.get("to")!) : undefined,
      ownerId: p.get("ownerId") ?? undefined,
      clientId: p.get("clientId") ?? undefined,
      status: status && status in AppointmentStatus ? (status as AppointmentStatus) : undefined,
    }),
  );
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createAppointmentSchema);
    return ok(await createAppointment(input, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
