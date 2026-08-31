import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import type { CreateContactInput, UpdateContactInput } from "./schema";

/**
 * Contact business logic, scoped to a parent client.
 *
 * Invariant: at most one primary contact per client. Whenever a contact is
 * created or updated as primary, any other primary for that client is demoted,
 * in a single transaction so the invariant can't be violated by a race.
 *
 * Contacts have no soft delete (SPEC scopes it to Client/Project/Deliverable);
 * they hard-delete, and cascade when their client is (hard) deleted.
 */
type Db = PrismaClient | Prisma.TransactionClient;

/** Guard that the parent client exists and isn't soft-deleted. */
async function assertClientActive(db: Db, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw ApiError.notFound("Client not found");
}

export async function listContacts(clientId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  return db.contact.findMany({
    where: { clientId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
}

export async function createContact(
  clientId: string,
  input: CreateContactInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const run = async (tx: Db) => {
    await assertClientActive(tx, clientId);
    if (input.isPrimary) await demoteOtherPrimaries(tx, clientId);
    const contact = await tx.contact.create({ data: { ...input, clientId } });
    opts.log?.debug(
      { contactId: contact.id, clientId },
      "db write: contact created",
    );
    return contact;
  };
  // Reuse an ambient transaction if one was injected (tests), else open one.
  return opts.db
    ? run(opts.db)
    : defaultPrisma.$transaction((tx) => run(tx));
}

export async function updateContact(
  clientId: string,
  contactId: string,
  input: UpdateContactInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const run = async (tx: Db) => {
    const existing = await tx.contact.findFirst({
      where: { id: contactId, clientId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Contact not found");
    if (input.isPrimary) await demoteOtherPrimaries(tx, clientId, contactId);
    const contact = await tx.contact.update({
      where: { id: contactId },
      data: input,
    });
    opts.log?.debug({ contactId, clientId }, "db write: contact updated");
    return contact;
  };
  return opts.db ? run(opts.db) : defaultPrisma.$transaction((tx) => run(tx));
}

export async function deleteContact(
  clientId: string,
  contactId: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  // Scope the delete to the client so a mismatched pair 404s instead of
  // deleting another client's contact.
  const result = await db.contact.deleteMany({
    where: { id: contactId, clientId },
  });
  if (result.count === 0) throw ApiError.notFound("Contact not found");
  opts.log?.debug({ contactId, clientId }, "db write: contact deleted");
}

/** Demote any existing primary contact(s) for the client, except `keepId`. */
async function demoteOtherPrimaries(db: Db, clientId: string, keepId?: string) {
  await db.contact.updateMany({
    where: {
      clientId,
      isPrimary: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isPrimary: false },
  });
}
