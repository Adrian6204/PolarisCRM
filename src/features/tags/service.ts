import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText } from "@/lib/validation";
import { TAG_COLOR_KEYS } from "./display";

/**
 * Tag business logic. Tags are a flat, org-wide vocabulary (unique by name)
 * that clients are labelled with (many-to-many). Assigning by name creates the
 * tag on first use (GHL-style), so the UI can offer "create + apply" in one go.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export const createTagSchema = z.object({
  name: shortText(40),
  color: z.enum(TAG_COLOR_KEYS as [string, ...string[]]).default("slate"),
});
export const assignTagSchema = z.object({
  // Assign an existing tag by id, or create-and-assign by name.
  tagId: z.string().min(1).optional(),
  name: shortText(40).optional(),
  color: z.enum(TAG_COLOR_KEYS as [string, ...string[]]).optional(),
}).refine((d) => d.tagId || d.name, { message: "tagId or name is required" });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type AssignTagInput = z.infer<typeof assignTagSchema>;

export async function listTags(opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.tag.findMany({ orderBy: { name: "asc" } });
}

export async function createTag(input: CreateTagInput, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  // Case-insensitive uniqueness by name.
  const existing = await db.tag.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (existing) throw ApiError.conflict("A tag with that name already exists");
  return db.tag.create({ data: { name: input.name, color: input.color } });
}

async function assertClientActive(db: Db, clientId: string) {
  const c = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
  if (!c) throw ApiError.notFound("Client not found");
}

/** Assign a tag to a client — by id, or create-by-name then assign. */
export async function assignTag(
  clientId: string,
  input: AssignTagInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);

  let tagId = input.tagId;
  if (!tagId && input.name) {
    const existing = await db.tag.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
    });
    tagId = existing?.id ?? (await db.tag.create({
      data: { name: input.name, color: input.color ?? "slate" },
    })).id;
  }
  if (!tagId) throw ApiError.badRequest("tagId or name is required");

  // Idempotent: composite PK means re-assigning is a no-op.
  await db.clientTag.upsert({
    where: { clientId_tagId: { clientId, tagId } },
    create: { clientId, tagId },
    update: {},
  });
  opts.log?.debug({ clientId, tagId }, "db write: tag assigned");
  return db.tag.findUnique({ where: { id: tagId } });
}

export async function unassignTag(
  clientId: string,
  tagId: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await db.clientTag.deleteMany({ where: { clientId, tagId } });
  opts.log?.debug({ clientId, tagId }, "db write: tag unassigned");
}

/** Tags currently on a client. */
export async function tagsForClient(clientId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const rows = await db.clientTag.findMany({
    where: { clientId },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  });
  return rows.map((r) => r.tag);
}
