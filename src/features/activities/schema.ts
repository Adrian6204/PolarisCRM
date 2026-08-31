import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { paginationSchema } from "@/lib/validation";

/**
 * Activity (interaction log) schemas. clientId comes from the route path and
 * created_by from the session — never the request body. projectId is optional
 * (client-level activity is allowed); its ownership is checked in the service.
 */
export const createActivitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  summary: z.string().trim().min(1, "summary is required").max(5000),
  projectId: z.string().min(1).nullish(),
});

export const listActivitiesQuerySchema = paginationSchema.extend({
  type: z.nativeEnum(ActivityType).optional(),
  projectId: z.string().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
