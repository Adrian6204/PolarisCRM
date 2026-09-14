import { z } from "zod";
import { shortText } from "@/lib/validation";

/**
 * API-key schemas. A key only carries a human label; its secret and owner are
 * generated/derived server-side, never supplied by the client.
 */
export const createApiKeySchema = z.object({
  name: shortText(80),
  // Optional lifetime. Omit (or 0) for a non-expiring key; capped at ~2 years.
  expiresInDays: z.coerce.number().int().min(1).max(730).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
