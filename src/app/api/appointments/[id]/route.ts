import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { updateAppointmentSchema, getAppointment, updateAppointment, deleteAppointment } from "@/features/appointments/service";

/**
 * /api/appointments/:id
 *   GET    — appointment detail (any authed user).
 *   PATCH  — reschedule / relink / set status (admin / project lead).
 *   DELETE — remove (admin / project lead).
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await getAppointment(String(params.id)));
});

export const PATCH = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, updateAppointmentSchema);
    return ok(await updateAppointment(String(params.id), input, { log }));
  },
  { rateLimit: "write" },
);

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteAppointment(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
