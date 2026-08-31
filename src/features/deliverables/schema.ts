import { z } from "zod";
import { DeliverableStatus } from "@prisma/client";
import { paginationSchema, shortText, optionalText } from "@/lib/validation";

/**
 * Deliverable (task) schemas. projectId comes from the route path on create.
 * ownerId is optional (unassigned allowed); its existence is checked in the
 * service, not here.
 */
export const createDeliverableSchema = z.object({
  title: shortText(300),
  description: optionalText(2000),
  ownerId: z.string().min(1).nullish(),
  dueDate: z.coerce.date().nullish(),
  status: z.nativeEnum(DeliverableStatus).default(DeliverableStatus.not_started),
});

export const updateDeliverableSchema = z
  .object({
    title: shortText(300).optional(),
    description: optionalText(2000),
    ownerId: z.string().min(1).nullish(),
    dueDate: z.coerce.date().nullish(),
    status: z.nativeEnum(DeliverableStatus).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export const listDeliverablesQuerySchema = paginationSchema.extend({
  projectId: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.nativeEnum(DeliverableStatus).optional(),
  q: optionalText(200),
});

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
export type ListDeliverablesQuery = z.infer<typeof listDeliverablesQuerySchema>;
