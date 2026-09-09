import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { signUploadSchema, signUpload } from "@/features/attachments/service";

/**
 * /api/clients/:id/attachments/sign — mint a signed upload URL/token so the
 * browser can upload a file directly to Storage (admin / project lead).
 */
export const dynamic = "force-dynamic";

export const POST = withApiRoute(
  async ({ req, params }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, signUploadSchema);
    return ok(await signUpload(String(params.id), input));
  },
  { rateLimit: "write" },
);
