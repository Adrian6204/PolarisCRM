import { z } from "zod";
import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { importClients, createClient } from "@/features/clients/service";
import { parseCsv } from "@/lib/csv";

/**
 * /api/clients/import — bulk-create clients from pasted/uploaded CSV
 * (admin / project lead). Each created client goes through the audited
 * createClient (so audit + automations fire); returns a per-row summary.
 */
export const dynamic = "force-dynamic";

const importSchema = z.object({ csv: z.string().min(1).max(1_000_000) });

export const POST = withApiRoute(
  async ({ req, log }) => {
    const user = await requireRole(Role.admin, Role.project_lead);
    const { csv } = await parseJson(req, importSchema);
    const rows = parseCsv(csv);
    const result = await importClients(rows, (input) => createClient(input, { log, actorId: user.id }));
    return ok(result);
  },
  { rateLimit: "write" },
);
