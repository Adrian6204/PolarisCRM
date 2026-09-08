import type { Prisma, PrismaClient } from "@prisma/client";
import { AutomationTrigger, AutomationActionType, ActivityType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Logger } from "@/lib/logger";

/**
 * Automation engine (G4). A domain event is matched against active rules for
 * its trigger; each rule whose equality conditions match the event context has
 * its actions executed in order, and the outcome is recorded as an
 * AutomationRun for observability.
 *
 * Actions perform their DB writes directly here (not via the emitting feature
 * services), so running an action can never re-trigger the engine — no loops.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export interface AutomationEvent {
  trigger: AutomationTrigger;
  /** The client the event concerns; required for client-targeted actions. */
  clientId?: string | null;
  /** Values used for condition matching and `{{token}}` templating. */
  context?: Record<string, string | number | null | undefined>;
}

/** All conditions (equality) must match the event context; empty = always. */
function conditionsMatch(conditions: unknown, context: Record<string, unknown>): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  const entries = Object.entries(conditions as Record<string, unknown>);
  if (entries.length === 0) return true;
  return entries.every(([k, v]) => String(context[k] ?? "") === String(v ?? ""));
}

/** Replace `{{token}}` occurrences from the event context. */
function template(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(context[key] ?? ""));
}

async function runAction(
  db: Db,
  type: AutomationActionType,
  config: Record<string, unknown>,
  event: AutomationEvent,
) {
  const ctx = event.context ?? {};
  const clientId = event.clientId ?? null;

  switch (type) {
    case AutomationActionType.add_tag: {
      if (!clientId) throw new Error("add_tag needs a client");
      const name = template(String(config.tag ?? ""), ctx).trim();
      if (!name) throw new Error("add_tag: empty tag name");
      const existing = await db.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      const tagId = existing?.id ?? (await db.tag.create({ data: { name, color: String(config.color ?? "slate") } })).id;
      await db.clientTag.upsert({
        where: { clientId_tagId: { clientId, tagId } },
        create: { clientId, tagId },
        update: {},
      });
      return `tagged "${name}"`;
    }
    case AutomationActionType.create_note: {
      if (!clientId) throw new Error("create_note needs a client");
      const body = template(String(config.body ?? ""), ctx).trim();
      if (!body) throw new Error("create_note: empty body");
      await db.note.create({ data: { clientId, body, createdById: null } });
      return "note created";
    }
    case AutomationActionType.log_activity: {
      if (!clientId) throw new Error("log_activity needs a client");
      const summary = template(String(config.summary ?? ""), ctx).trim();
      if (!summary) throw new Error("log_activity: empty summary");
      const t = String(config.type ?? "note");
      const activityType = (Object.values(ActivityType) as string[]).includes(t)
        ? (t as ActivityType)
        : ActivityType.note;
      await db.activity.create({ data: { clientId, type: activityType, summary, createdById: null } });
      return `activity logged (${activityType})`;
    }
    default:
      throw new Error(`unknown action type: ${type}`);
  }
}

/**
 * Match and run all active automations for an event. Best-effort per rule: a
 * failing rule is recorded as an error run and does not abort the others.
 */
export async function runAutomations(event: AutomationEvent, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const ctx = event.context ?? {};

  const rules = await db.automation.findMany({
    where: { trigger: event.trigger, active: true },
    include: { actions: { orderBy: { sortOrder: "asc" } } },
  });

  for (const rule of rules) {
    if (!conditionsMatch(rule.conditions, ctx)) continue;
    try {
      const results: string[] = [];
      for (const action of rule.actions) {
        results.push(await runAction(db, action.type, (action.config ?? {}) as Record<string, unknown>, event));
      }
      await db.automationRun.create({
        data: {
          automationId: rule.id,
          clientId: event.clientId ?? null,
          status: "success",
          detail: results.join("; ") || "no actions",
        },
      });
      opts.log?.debug({ automationId: rule.id, trigger: event.trigger }, "automation ran");
    } catch (err) {
      await db.automationRun.create({
        data: {
          automationId: rule.id,
          clientId: event.clientId ?? null,
          status: "error",
          detail: err instanceof Error ? err.message : "unknown error",
        },
      });
      opts.log?.error({ automationId: rule.id, err }, "automation failed");
    }
  }
}
