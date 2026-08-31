import { z } from "zod";
import { optionalText } from "@/lib/validation";

/**
 * ReportEntry schemas. metrics is a flexible key→value map (JSON on the DB) so
 * each service type records what it tracks; we constrain values to JSON scalars
 * so the report UI can render them safely.
 */
export const upsertReportSchema = z.object({
  // "YYYY-MM", e.g. "2026-08".
  period: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be "YYYY-MM"'),
  metrics: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
  notes: optionalText(5000),
});

export type UpsertReportInput = z.infer<typeof upsertReportSchema>;
