import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import { recordAttachmentSchema, listAttachments, recordAttachment } from "@/features/attachments/service";

/**
 * /api/clients/:id/attachments
 *   GET  — list a client's attachments (any authenticated user)
 *   POST — record metadata after a direct-to-Storage upload (admin / lead)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await listAttachments(String(params.id)));
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, recordAttachmentSchema);
    return ok(await recordAttachment(String(params.id), input, user.id, { log }), { status: 201 });
  },
  { rateLimit: "write" },
);
