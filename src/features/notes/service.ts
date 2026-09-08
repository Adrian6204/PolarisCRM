import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";

/**
 * Notes — free-form text attached to a client, distinct from the timestamped
 * Activity log. Author captured from the session. Hard-deletable (no soft
 * delete; a note is minor and correctable).
 */
type Db = PrismaClient | Prisma.TransactionClient;

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, "note cannot be empty").max(5000),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

const author = { select: { id: true, name: true, email: true } } as const;

export async function listNotes(clientId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.note.findMany({
    where: { clientId },
    include: { createdBy: author },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNote(
  clientId: string,
  input: CreateNoteInput,
  createdById: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const client = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
  if (!client) throw ApiError.notFound("Client not found");
  const note = await db.note.create({
    data: { clientId, body: input.body, createdById },
    include: { createdBy: author },
  });
  opts.log?.debug({ noteId: note.id, clientId }, "db write: note created");
  return note;
}

export async function deleteNote(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.note.deleteMany({ where: { id } });
  if (res.count === 0) throw ApiError.notFound("Note not found");
  opts.log?.debug({ noteId: id }, "db write: note deleted");
}
