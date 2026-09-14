import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { hashKey, looksLikeApiKey } from "./keys";

/**
 * The authenticated actor behind an MCP request. Mirrors the shape of the
 * session-derived `AuthedUser` so tools can reuse the same `assertRole` gate the
 * web routes use, an agent acting through a key is just a user with a role.
 */
export interface McpActor {
  id: string;
  email: string;
  role: Role;
  keyId: string;
}

/**
 * Resolve a raw bearer token to its actor, or throw 401. A key is valid only if
 * it exists, is not revoked, and belongs to an active user. `lastUsed` is
 * stamped best-effort (fire-and-forget) so a slow write never blocks a request.
 */
export async function resolveApiKey(raw: string | undefined | null): Promise<McpActor> {
  if (!raw || !looksLikeApiKey(raw)) throw ApiError.unauthorized("Missing or malformed API key");

  const record = await prisma.apiKey.findUnique({
    where: { hash: hashKey(raw) },
    include: { user: true },
  });

  // Uniform "unauthorized" for every failure mode, never disclose whether a
  // key exists, is revoked, expired, or maps to a disabled account.
  const expired = record?.expiresAt != null && record.expiresAt.getTime() <= Date.now();
  if (!record || record.revokedAt || expired || !record.user.active) {
    throw ApiError.unauthorized("Invalid API key");
  }

  void prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsed: new Date() } })
    .catch(() => {
      /* best-effort telemetry; a failed touch must not fail the request */
    });

  return {
    id: record.user.id,
    email: record.user.email,
    role: record.user.role,
    keyId: record.id,
  };
}

/** Extract a bearer token from an Authorization header value. */
export function bearerFromHeader(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}
