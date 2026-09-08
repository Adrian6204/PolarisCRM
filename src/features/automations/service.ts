import type { PrismaClient } from "@prisma/client";
import { Prisma, AutomationTrigger, AutomationActionType, ActivityType } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText } from "@/lib/validation";

/**
 * Automation CRUD (G4). Rules are org-wide and admin-managed. Action configs
 * are validated per action type on write so the engine can trust their shape.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const TRIGGERS = Object.values(AutomationTrigger) as [AutomationTrigger, ...AutomationTrigger[]];
const ACTIVITY_TYPES = Object.values(ActivityType) as [ActivityType, ...ActivityType[]];

// Per-action-type config schemas; the discriminated shape is validated by type.
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(AutomationActionType.add_tag), tag: shortText(40), color: z.string().optional() }),
  z.object({ type: z.literal(AutomationActionType.create_note), body: shortText(2000) }),
  z.object({
    type: z.literal(AutomationActionType.log_activity),
    summary: shortText(500),
    activityType: z.enum(ACTIVITY_TYPES).default(ActivityType.note),
  }),
]);

export const createAutomationSchema = z.object({
  name: shortText(80),
  trigger: z.enum(TRIGGERS),
  conditions: z.record(z.string(), z.string()).optional(),
  active: z.boolean().default(true),
  actions: z.array(actionSchema).min(1).max(10),
});

export const updateAutomationSchema = z
  .object({
    name: shortText(80).optional(),
    active: z.boolean().optional(),
    conditions: z.record(z.string(), z.string()).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

/** Split a validated action into its stored (type, config) columns. */
function toActionRow(action: z.infer<typeof actionSchema>, sortOrder: number) {
  const { type, ...rest } = action;
  const config =
    type === AutomationActionType.log_activity
      ? { summary: (rest as { summary: string }).summary, type: (rest as { activityType: ActivityType }).activityType }
      : rest;
  return { type, config: config as Prisma.InputJsonValue, sortOrder };
}

const withActions = { actions: { orderBy: { sortOrder: "asc" } } } satisfies Prisma.AutomationInclude;

export async function listAutomations(opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.automation.findMany({ include: withActions, orderBy: { createdAt: "asc" } });
}

export async function createAutomation(input: CreateAutomationInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const automation = await db.automation.create({
    data: {
      name: input.name,
      trigger: input.trigger,
      conditions: input.conditions && Object.keys(input.conditions).length > 0 ? input.conditions : undefined,
      active: input.active,
      actions: { create: input.actions.map((a, i) => toActionRow(a, i)) },
    },
    include: withActions,
  });
  opts.log?.debug({ automationId: automation.id }, "db write: automation created");
  return automation;
}

export async function updateAutomation(id: string, input: UpdateAutomationInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const data: Prisma.AutomationUpdateInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.conditions !== undefined ? { conditions: input.conditions ?? Prisma.DbNull } : {}),
  };
  const res = await db.automation.updateMany({ where: { id }, data });
  if (res.count === 0) throw ApiError.notFound("Automation not found");
  opts.log?.debug({ automationId: id }, "db write: automation updated");
  return db.automation.findUnique({ where: { id }, include: withActions });
}

export async function deleteAutomation(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.automation.deleteMany({ where: { id } });
  if (res.count === 0) throw ApiError.notFound("Automation not found");
  opts.log?.debug({ automationId: id }, "db write: automation deleted");
}

/** Recent run log across all automations (for the settings UI). */
export async function listRecentRuns(limit = 20, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.automationRun.findMany({
    include: { automation: { select: { name: true, trigger: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
