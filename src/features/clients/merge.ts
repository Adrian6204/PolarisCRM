import type { Prisma, PrismaClient } from "@prisma/client";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { runInTx } from "@/lib/tx";
import { auditData } from "@/features/audit/service";

/**
 * Merge one client (source) into another (target): reassign every related
 * record to the target, then soft-delete the source. Runs in a transaction so
 * a partial merge can never happen. Composite-key relations (tags, custom
 * fields) are de-duplicated — where both clients share a tag/field, the
 * target's row wins and the source's is dropped.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export interface MergeOpts {
  db?: Db;
  log?: Logger;
  actorId?: string | null;
}

const notDeleted = { deletedAt: null } satisfies Prisma.ClientWhereInput;

export async function mergeClients(sourceId: string, targetId: string, opts: MergeOpts = {}) {
  if (sourceId === targetId) throw ApiError.badRequest("Cannot merge a client into itself");

  return runInTx(opts.db, async (tx) => {
    const [source, target] = await Promise.all([
      tx.client.findFirst({ where: { id: sourceId, ...notDeleted } }),
      tx.client.findFirst({ where: { id: targetId, ...notDeleted } }),
    ]);
    if (!source) throw ApiError.notFound("Source client not found");
    if (!target) throw ApiError.notFound("Target client not found");

    // Simple 1:N relations — just repoint the FK.
    await Promise.all([
      tx.contact.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.project.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.activity.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.deal.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.note.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.appointment.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
      tx.auditLog.updateMany({ where: { clientId: sourceId }, data: { clientId: targetId } }),
    ]);

    // Composite-key relations — move only where the target lacks the row
    // (target wins on a clash), otherwise drop the source's duplicate.
    const [srcTags, tgtTags] = await Promise.all([
      tx.clientTag.findMany({ where: { clientId: sourceId }, select: { tagId: true } }),
      tx.clientTag.findMany({ where: { clientId: targetId }, select: { tagId: true } }),
    ]);
    const tgtTagIds = new Set(tgtTags.map((t) => t.tagId));
    for (const { tagId } of srcTags) {
      const where = { clientId_tagId: { clientId: sourceId, tagId } };
      if (tgtTagIds.has(tagId)) await tx.clientTag.delete({ where });
      else await tx.clientTag.update({ where, data: { clientId: targetId } });
    }

    const [srcFields, tgtFields] = await Promise.all([
      tx.clientCustomField.findMany({ where: { clientId: sourceId }, select: { fieldId: true } }),
      tx.clientCustomField.findMany({ where: { clientId: targetId }, select: { fieldId: true } }),
    ]);
    const tgtFieldIds = new Set(tgtFields.map((f) => f.fieldId));
    for (const { fieldId } of srcFields) {
      const where = { clientId_fieldId: { clientId: sourceId, fieldId } };
      if (tgtFieldIds.has(fieldId)) await tx.clientCustomField.delete({ where });
      else await tx.clientCustomField.update({ where, data: { clientId: targetId } });
    }

    // Retire the source.
    await tx.client.update({ where: { id: sourceId }, data: { deletedAt: new Date() } });

    if (opts.actorId) {
      await tx.auditLog.create({
        data: auditData({
          entityType: AuditEntityType.client,
          entityId: targetId,
          action: AuditAction.update,
          clientId: targetId,
          actorId: opts.actorId,
          before: { merged: false },
          after: { mergedFrom: sourceId, mergedFromName: source.name },
        }),
      });
    }
    opts.log?.debug({ sourceId, targetId }, "db write: clients merged");
    return { targetId, sourceId };
  });
}

/** Non-deleted clients other than the target, flagged when they share a name. */
export async function listMergeCandidates(targetId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const target = await db.client.findFirst({ where: { id: targetId, ...notDeleted }, select: { name: true } });
  if (!target) throw ApiError.notFound("Client not found");
  const others = await db.client.findMany({
    where: { ...notDeleted, NOT: { id: targetId } },
    select: { id: true, name: true, industry: true },
    orderBy: { name: "asc" },
  });
  const tName = target.name.trim().toLowerCase();
  return others.map((c) => ({ ...c, sameName: c.name.trim().toLowerCase() === tName }));
}
