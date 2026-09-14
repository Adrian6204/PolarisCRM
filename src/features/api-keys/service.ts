import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { generateApiKey } from "@/lib/mcp/keys";
import type { CreateApiKeyInput } from "./schema";

/**
 * API-key management. Keys are personal access tokens for the MCP server, scoped
 * to their owning user. The raw secret exists only at creation time — we persist
 * the SHA-256 hash (see @/lib/mcp/keys) and return the raw value once for the
 * user to copy. Revocation is a soft state (`revokedAt`) so the audit of what a
 * key did survives.
 */
type Db = PrismaClient | Prisma.TransactionClient;

/** Non-secret view of a key for listing in the UI. */
export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  lastUsed: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

const summarySelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsed: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.ApiKeySelect;

/** List a user's keys, newest first. Secrets are never returned. */
export function listApiKeys(userId: string, opts: { db?: Db } = {}): Promise<ApiKeySummary[]> {
  const db = opts.db ?? defaultPrisma;
  return db.apiKey.findMany({
    where: { userId },
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  });
}

export interface CreatedApiKey {
  summary: ApiKeySummary;
  /** The full secret — shown once, never retrievable again. */
  raw: string;
}

/** Mint a new key for a user and return the one-time raw secret. */
export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
  opts: { db?: Db; log?: Logger } = {},
): Promise<CreatedApiKey> {
  const db = opts.db ?? defaultPrisma;
  const { raw, hash, prefix } = generateApiKey();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const summary = await db.apiKey.create({
    data: { userId, name: input.name, hash, prefix, expiresAt },
    select: summarySelect,
  });
  opts.log?.debug({ apiKeyId: summary.id, userId }, "db write: api key created");
  return { summary, raw };
}

/**
 * Revoke a key the user owns. Scoped by userId so one user can never revoke
 * another's key. 404 if it doesn't exist or isn't theirs.
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  opts: { db?: Db; log?: Logger } = {},
): Promise<void> {
  const db = opts.db ?? defaultPrisma;
  const result = await db.apiKey.updateMany({
    where: { id: keyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound("API key not found");
  opts.log?.debug({ apiKeyId: keyId, userId }, "db write: api key revoked");
}
