import { Role } from "@prisma/client";
import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { upsertReportSchema } from "@/features/reports/schema";
import { upsertReport } from "@/features/reports/service";

/**
 * /api/projects/:id/reports
 *   POST — create or update the report for a period (admin / project lead).
 *          One report per project per period, so this upserts.
 */
export const dynamic = "force-dynamic";

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    await requireRole(Role.admin, Role.project_lead);
    const input = await parseJson(req, upsertReportSchema);
    const report = await upsertReport(String(params.id), input, { log });
    return ok(report, { status: 201 });
  },
  { rateLimit: "write" },
);
