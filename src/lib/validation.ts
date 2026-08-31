import { z } from "zod";

/**
 * Shared validation helpers. Feature schemas (Client, Project, ...) live with
 * their feature but should compose these primitives so validation stays
 * consistent (pagination shape, id format, trimming) across routes.
 */

/** cuid-style id used by Prisma `@default(cuid())`. */
export const idSchema = z.string().min(1, "id is required");

/** Trimmed non-empty string with a max length. */
export const shortText = (max = 255) =>
  z.string().trim().min(1).max(max);

/** Optional trimmed string that treats "" as undefined. */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** Standard list pagination (query-string friendly — coerces strings). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Turn a validated pagination into Prisma skip/take. */
export function toSkipTake({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
