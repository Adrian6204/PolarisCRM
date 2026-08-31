import { z } from "zod";
import { ClientStatus } from "@prisma/client";
import { optionalText, paginationSchema, shortText } from "@/lib/validation";

/**
 * Zod schemas for Client writes and list queries. Routes validate against
 * these before touching the DB (SPEC cross-cutting requirement). `z.nativeEnum`
 * keeps the accepted status values in lockstep with the Prisma enum.
 */

// A website is optional, but if present must be a URL. Empty string → omitted.
const websiteSchema = z
  .string()
  .trim()
  .url("website must be a valid URL")
  .max(2048)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createClientSchema = z.object({
  name: shortText(200),
  industry: optionalText(120),
  website: websiteSchema,
  status: z.nativeEnum(ClientStatus).default(ClientStatus.prospect),
});

// Partial update — every field optional, but reject an empty object so a PATCH
// always expresses at least one change.
export const updateClientSchema = createClientSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

export const listClientsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ClientStatus).optional(),
  // Free-text search over client name (case-insensitive contains).
  q: optionalText(200),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
