import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withApiRoute, ok } from "@/lib/api";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getDownloadUrl, deleteAttachment } from "@/features/attachments/service";

/**
 * /api/attachments/:id
 *   GET    — redirect to a short-lived signed download URL (any authed user)
 *   DELETE — remove the file + its metadata (admin / project lead)
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  try {
    const url = await getDownloadUrl(id);
    return NextResponse.redirect(url);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Download failed";
    return new Response(message, { status });
  }
}

export const DELETE = withApiRoute(
  async ({ params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    await deleteAttachment(String(params.id), { log });
    return ok({ id: params.id, deleted: true });
  },
  { rateLimit: "write" },
);
