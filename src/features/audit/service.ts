import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { logger, type Logger } from "@/lib/logger";

/**
 * Audit trail (Phase 7). Records create/update/delete on Client, Project and
 * Deliverable with a before/after diff and who made the change.
 *
 * `recordAudit` is best-effort: it never throws into the caller, so a failure
 * to write the audit row can't fail the user's actual operation. Failures are
 * logged at error level (and reach Sentry via the route wrapper's logger). The
 * `clientId` is denormalized onto every row so the per-client trail is one
 * indexed query.
 */
type Db = PrismaClient | Prisma.TransactionClient;

// Volatile fields and relation objects excluded from diffs — audit tracks
// scalar columns, not timestamps or included relations.
const IGNORED_FIELDS = new Set([
  "updatedAt",
  "createdAt",
  "owner",
  "project",
  "client",
  "contacts",
  "deliverables",
  "activities",
  "reports",
  "changedBy",
  "_count",
]);

type Snapshot = Record<string, unknown>;

/** JSON-safe snapshot: Dates → ISO strings, volatile fields dropped. */
function sanitize(obj: unknown): Snapshot {
  if (!obj || typeof obj !== "object") return {};
  const out: Snapshot = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (IGNORED_FIELDS.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/**
 * Build the diff payload for an action:
 *   create → { after }
 *   delete → { before }
 *   update → { changed: { field: { from, to } } } for fields that differ
 */
export function computeDiff(
  action: AuditAction,
  before: unknown,
  after: unknown,
): Prisma.InputJsonValue {
  // Values are already JSON-safe (sanitize converts Dates); cast through
  // unknown to satisfy Prisma's strict JSON input type.
  const asJson = (v: unknown) => v as Prisma.InputJsonValue;

  if (action === AuditAction.create) return asJson({ after: sanitize(after) });
  if (action === AuditAction.delete) return asJson({ before: sanitize(before) });

  const b = sanitize(before);
  const a = sanitize(after);
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      changed[key] = { from: b[key] ?? null, to: a[key] ?? null };
    }
  }
  return asJson({ changed });
}

export interface AuditInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  clientId: string | null;
  actorId: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Build the row for `auditLog.create`. Services call this inside their own
 * transaction so the audit entry commits atomically with the mutation — no
 * change can be persisted without its audit record (Phase 9 hardening).
 */
export function auditData(params: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    clientId: params.clientId,
    changedById: params.actorId,
    diff: computeDiff(params.action, params.before, params.after),
  };
}

export interface RecordAuditParams extends AuditInput {
  db?: Db;
  log?: Logger;
}

/**
 * Best-effort audit write for callers that aren't inside a transaction. Never
 * throws into the caller. Prefer writing `auditData()` inside the mutation's
 * transaction where atomicity matters.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const { db = defaultPrisma, log = logger } = params;
  try {
    await db.auditLog.create({ data: auditData(params) });
  } catch (err) {
    log.error(
      { err, entityType: params.entityType, entityId: params.entityId, action: params.action },
      "audit write failed",
    );
  }
}

export type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: { changedBy: { select: { id: true; name: true; email: true } } };
}>;

/** Per-client audit trail (the client + its projects/deliverables), newest first. */
export async function listClientAuditTrail(
  clientId: string,
  opts: { db?: Db; limit?: number } = {},
): Promise<AuditLogWithActor[]> {
  const db = opts.db ?? defaultPrisma;
  return db.auditLog.findMany({
    where: { clientId },
    include: { changedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}
