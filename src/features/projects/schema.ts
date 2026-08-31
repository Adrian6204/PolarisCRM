import { z } from "zod";
import {
  ServiceType,
  EngagementType,
  ProjectStatus,
} from "@prisma/client";
import { paginationSchema, shortText, optionalText } from "@/lib/validation";
import { isValidStage } from "./stages";

/**
 * Project write/list schemas. clientId is taken from the route path (projects
 * are created under /api/clients/:id/projects), not the body.
 *
 * Cross-field rules enforced here at create time:
 *   - stage (if given) must belong to the service/engagement's stage set
 *   - retainer_renewal_date only allowed for retainer engagements
 *   - end_date, if given, must not precede start_date
 * Stage validity on *update* is enforced in the service, where the project's
 * existing service/engagement type is known.
 */
export const createProjectSchema = z
  .object({
    name: shortText(200),
    serviceType: z.nativeEnum(ServiceType),
    engagementType: z.nativeEnum(EngagementType),
    // Optional — defaults to the first stage of the set in the service layer.
    stage: optionalText(60),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullish(),
    retainerRenewalDate: z.coerce.date().nullish(),
    status: z.nativeEnum(ProjectStatus).default(ProjectStatus.active),
  })
  .superRefine((data, ctx) => {
    if (data.stage && !isValidStage(data.serviceType, data.engagementType, data.stage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stage"],
        message: `Invalid stage "${data.stage}" for ${data.serviceType}/${data.engagementType}`,
      });
    }
    if (data.engagementType === EngagementType.one_off && data.retainerRenewalDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retainerRenewalDate"],
        message: "retainerRenewalDate is only valid for retainer engagements",
      });
    }
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate cannot be before startDate",
      });
    }
  });

// Update: all fields optional. serviceType/engagementType are intentionally
// NOT updatable here — changing them would invalidate the stage/history, which
// is better modelled as a new engagement. Stage transitions and status/date
// edits are the common mutations.
export const updateProjectSchema = z
  .object({
    name: shortText(200).optional(),
    stage: shortText(60).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullish(),
    retainerRenewalDate: z.coerce.date().nullish(),
    status: z.nativeEnum(ProjectStatus).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export const listProjectsQuerySchema = paginationSchema.extend({
  clientId: z.string().optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  engagementType: z.nativeEnum(EngagementType).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  q: optionalText(200),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
