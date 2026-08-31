import { z } from "zod";
import { DealStage } from "@prisma/client";
import { paginationSchema, shortText, optionalText } from "@/lib/validation";

/**
 * Deal (sales opportunity) schemas. clientId comes from the route path on
 * create. `value` is a whole-currency-unit estimate; ownerId is optional.
 */
export const createDealSchema = z.object({
  title: shortText(200),
  value: z.coerce.number().int().min(0).default(0),
  stage: z.nativeEnum(DealStage).default(DealStage.lead),
  ownerId: z.string().min(1).nullish(),
  notes: optionalText(2000),
  expectedCloseDate: z.coerce.date().nullish(),
});

export const updateDealSchema = z
  .object({
    title: shortText(200).optional(),
    value: z.coerce.number().int().min(0).optional(),
    stage: z.nativeEnum(DealStage).optional(),
    ownerId: z.string().min(1).nullish(),
    notes: optionalText(2000),
    expectedCloseDate: z.coerce.date().nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export const listDealsQuerySchema = paginationSchema.extend({
  clientId: z.string().optional(),
  stage: z.nativeEnum(DealStage).optional(),
  ownerId: z.string().optional(),
  q: optionalText(200),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;
