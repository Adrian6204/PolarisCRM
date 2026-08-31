import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import type { Pagination } from "@/lib/validation";
import { toSkipTake } from "@/lib/validation";
import { recordAudit } from "@/features/audit/service";
import type {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from "./schema";

/**
 * Client business logic. All reads are soft-delete-aware: they filter
 * `deletedAt: null` so soft-deleted clients never surface through the app.
 * Every write is logged at debug level (SPEC: log every DB write).
 *
 * The prisma client is injected (defaulting to the singleton) so the service
 * is unit-testable with a mock.
 */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Options for write operations. `actorId` is the user making the change; when
 * present, the write records an audit entry (Phase 7). Routes always pass it;
 * unit tests may omit it to exercise the write in isolation.
 */
export interface WriteOpts {
  db?: Db;
  log?: Logger;
  actorId?: string | null;
}

/** Reusable predicate — a non-deleted client. */
const notDeleted = { deletedAt: null } satisfies Prisma.ClientWhereInput;

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listClients(
  query: ListClientsQuery,
  opts: { db?: Db } = {},
): Promise<ListResult<Prisma.ClientGetPayload<object>>> {
  const db = opts.db ?? defaultPrisma;
  const where: Prisma.ClientWhereInput = {
    ...notDeleted,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
  };
  const pagination: Pagination = { page: query.page, pageSize: query.pageSize };

  // Count + page in one round-trip.
  const [total, items] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(pagination),
    }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export type ClientWithContacts = Prisma.ClientGetPayload<{
  include: { contacts: true };
}>;
export type ClientRecord = Prisma.ClientGetPayload<object>;

/** Fetch a single non-deleted client (optionally with contacts), or 404. */
export function getClient(
  id: string,
  opts: { db?: Db; withContacts: true },
): Promise<ClientWithContacts>;
export function getClient(
  id: string,
  opts?: { db?: Db; withContacts?: false },
): Promise<ClientRecord>;
export async function getClient(
  id: string,
  opts: { db?: Db; withContacts?: boolean } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const client = await db.client.findFirst({
    where: { id, ...notDeleted },
    include: opts.withContacts
      ? { contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } }
      : undefined,
  });
  if (!client) throw ApiError.notFound("Client not found");
  return client;
}

export async function createClient(
  input: CreateClientInput,
  opts: WriteOpts = {},
) {
  const db = opts.db ?? defaultPrisma;
  const client = await db.client.create({ data: input });
  opts.log?.debug({ clientId: client.id }, "db write: client created");
  if (opts.actorId) {
    await recordAudit({
      entityType: AuditEntityType.client,
      entityId: client.id,
      action: AuditAction.create,
      clientId: client.id,
      actorId: opts.actorId,
      after: client,
      db,
      log: opts.log,
    });
  }
  return client;
}

export async function updateClient(
  id: string,
  input: UpdateClientInput,
  opts: WriteOpts = {},
) {
  const db = opts.db ?? defaultPrisma;
  // Capture the pre-update state for the audit diff (only when auditing).
  const before = opts.actorId
    ? await db.client.findFirst({ where: { id, ...notDeleted } })
    : null;
  // Ensure it exists and isn't soft-deleted before updating (updateMany avoids
  // resurrecting a deleted row; count tells us whether it matched).
  const result = await db.client.updateMany({
    where: { id, ...notDeleted },
    data: input,
  });
  if (result.count === 0) throw ApiError.notFound("Client not found");
  opts.log?.debug({ clientId: id }, "db write: client updated");
  const after = await getClient(id, { db });
  if (opts.actorId) {
    await recordAudit({
      entityType: AuditEntityType.client,
      entityId: id,
      action: AuditAction.update,
      clientId: id,
      actorId: opts.actorId,
      before,
      after,
      db,
      log: opts.log,
    });
  }
  return after;
}

/** Soft delete — sets deletedAt. Idempotent-ish: 404 if already gone. */
export async function softDeleteClient(id: string, opts: WriteOpts = {}) {
  const db = opts.db ?? defaultPrisma;
  const before = opts.actorId
    ? await db.client.findFirst({ where: { id, ...notDeleted } })
    : null;
  const result = await db.client.updateMany({
    where: { id, ...notDeleted },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound("Client not found");
  opts.log?.debug({ clientId: id }, "db write: client soft-deleted");
  if (opts.actorId) {
    await recordAudit({
      entityType: AuditEntityType.client,
      entityId: id,
      action: AuditAction.delete,
      clientId: id,
      actorId: opts.actorId,
      before,
      db,
      log: opts.log,
    });
  }
}
