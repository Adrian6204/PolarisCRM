import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText } from "@/lib/validation";
import { createSignedUpload, createSignedDownload, removeObject } from "@/lib/storage";

/**
 * File attachments (P9). Bytes live in Supabase Storage; these rows hold the
 * metadata. Upload is two-step: the client asks for a signed upload URL
 * (scoped to a generated path under the client), uploads directly to Storage,
 * then records the metadata here.
 */
type Db = PrismaClient | Prisma.TransactionClient;

// 25 MB cap — generous for docs/images, safe for a signed direct upload.
const MAX_SIZE = 25 * 1024 * 1024;

export const signUploadSchema = z.object({
  name: shortText(200),
  size: z.number().int().min(1).max(MAX_SIZE),
  contentType: shortText(150),
});

export const recordAttachmentSchema = z.object({
  name: shortText(200),
  path: shortText(400),
  size: z.number().int().min(0).max(MAX_SIZE),
  contentType: shortText(150),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type RecordAttachmentInput = z.infer<typeof recordAttachmentSchema>;

const author = { select: { id: true, name: true, email: true } } as const;

async function assertClientActive(db: Db, clientId: string) {
  const c = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
  if (!c) throw ApiError.notFound("Client not found");
}

/** Slugify a filename for a safe storage path, preserving the extension. */
function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  return ext ? `${base}.${ext}` : base;
}

/** Create a signed upload URL under `clients/<id>/<rand>-<name>`. */
export async function signUpload(clientId: string, input: SignUploadInput, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `clients/${clientId}/${rand}-${safeName(input.name)}`;
  const signed = await createSignedUpload(path);
  return { ...signed, name: input.name, size: input.size, contentType: input.contentType };
}

export async function listAttachments(clientId: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.attachment.findMany({
    where: { clientId },
    include: { uploadedBy: author },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordAttachment(
  clientId: string,
  input: RecordAttachmentInput,
  uploadedById: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  await assertClientActive(db, clientId);
  // Guard against a path outside this client's folder (client-supplied value).
  if (!input.path.startsWith(`clients/${clientId}/`)) throw ApiError.badRequest("Invalid attachment path");
  const attachment = await db.attachment.create({
    data: {
      clientId,
      name: input.name,
      path: input.path,
      size: input.size,
      contentType: input.contentType,
      uploadedById,
    },
    include: { uploadedBy: author },
  });
  opts.log?.debug({ attachmentId: attachment.id, clientId }, "db write: attachment recorded");
  return attachment;
}

/** A short-lived signed URL to download an attachment. */
export async function getDownloadUrl(id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const a = await db.attachment.findUnique({ where: { id }, select: { path: true } });
  if (!a) throw ApiError.notFound("Attachment not found");
  return createSignedDownload(a.path);
}

export async function deleteAttachment(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const a = await db.attachment.findUnique({ where: { id }, select: { id: true, path: true } });
  if (!a) throw ApiError.notFound("Attachment not found");
  await removeObject(a.path).catch(() => {}); // best-effort; row removal is source of truth
  await db.attachment.delete({ where: { id } });
  opts.log?.debug({ attachmentId: id }, "db write: attachment deleted");
}
