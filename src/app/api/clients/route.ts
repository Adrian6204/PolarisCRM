import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson, parseQuery } from "@/lib/api";
import { requireUser, requireRole } from "@/lib/auth";
import {
  createClientSchema,
  listClientsQuerySchema,
} from "@/features/clients/schema";
import { createClient, listClients } from "@/features/clients/service";

/**
 * /api/clients
 *   GET  — list clients (any authenticated user). Light/no rate limiting on
 *          internal reads per SPEC until usage data says otherwise.
 *   POST — create a client (admin / project lead only). Moderate `write` limit.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ req, log }) => {
  await requireUser();
  const query = parseQuery(req, listClientsQuerySchema);
  const result = await listClients(query);
  log.debug({ total: result.total }, "listed clients");
  return ok(result);
});

export const POST = withApiRoute(
  async ({ req, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, createClientSchema);
    const client = await createClient(input, { log, actorId: user.id });
    return ok(client, { status: 201 });
  },
  { rateLimit: "write" },
);
