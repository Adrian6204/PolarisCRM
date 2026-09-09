import { z } from "zod";
import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { mergeClients } from "@/features/clients/merge";

/**
 * /api/clients/:id/merge — merge another client (sourceId) INTO :id (the
 * survivor). Destructive + reassigns records, so admin-only.
 */
export const dynamic = "force-dynamic";

const mergeSchema = z.object({ sourceId: z.string().min(1) });

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireRole(Role.admin);
    const { sourceId } = await parseJson(req, mergeSchema);
    const result = await mergeClients(sourceId, String(params.id), { log, actorId: user.id });
    return ok(result);
  },
  { rateLimit: "write" },
);
