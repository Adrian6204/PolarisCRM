import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerTools } from "@/lib/mcp/server";
import { resolveApiKey } from "@/lib/mcp/auth";
import { mcpEnabled, isProd, hasRedis } from "@/lib/env";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/ratelimit";

/**
 * Remote MCP endpoint (Streamable HTTP) exposing the CRM as agent tools.
 *
 * Serverless-safe: stateless request/response only (no Redis-backed SSE store,
 * so no long-lived process is needed), consistent with the rest of the app.
 *
 * Auth: every request must carry `Authorization: Bearer <api-key>`. The key is
 * resolved to its owning user (see @/lib/mcp/auth) and stashed on the request's
 * AuthInfo; tools then enforce that user's role via the shared `assertRole`.
 * The whole endpoint is gated behind MCP_ENABLED so it can never ship on by
 * accident.
 *
 * Defense in depth: a per-IP limit runs *before* token verification, so
 * unauthenticated requests can't hammer the DB key-lookup (post-auth, per-key
 * limits in the tool guard bound authenticated abuse). NB: rate limiting
 * degrades open when Upstash isn't configured, keep it set in any environment
 * where MCP_ENABLED is true.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const baseHandler = createMcpHandler(
  (server: McpServer) => {
    registerTools(server);
  },
  // ServerOptions (capabilities/instructions), defaults are fine.
  {},
  // Handler config. No redisUrl → stateless request/response (no SSE), which is
  // exactly what a tools-only server needs on serverless. basePath must match
  // where this route is mounted so the transport resolves "/api/mcp".
  { basePath: "/api", maxDuration: 60 },
);

/** Turn a bearer token into MCP AuthInfo, or undefined to trigger a 401. */
async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  try {
    const actor = await resolveApiKey(bearer);
    return {
      token: bearer,
      clientId: actor.keyId,
      // Scope carries the role for observability; enforcement is in the tools.
      scopes: [actor.role],
      extra: { actor },
    };
  } catch {
    // Any resolution failure → unauthenticated (withMcpAuth returns 401).
    return undefined;
  }
}

const authedHandler = withMcpAuth(baseHandler, verifyToken, { required: true });

/** Proxy-aware client IP for the pre-auth rate-limit key. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function handler(req: Request): Promise<Response> {
  if (!mcpEnabled) {
    logger.debug("mcp request rejected, MCP_ENABLED is not 'true'");
    return new Response("Not found", { status: 404 });
  }

  // Fail closed: never expose a public, mutating endpoint in production without
  // the rate limiter, which would otherwise degrade open (see ratelimit.ts).
  if (isProd && !hasRedis) {
    logger.error("mcp endpoint enabled in production without Upstash, refusing requests");
    return new Response(
      JSON.stringify({ error: { code: "internal_error", message: "MCP endpoint misconfigured" } }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  // Bound unauthenticated damage: throttle by IP before the DB key lookup.
  const rl = await enforceRateLimit("read", `mcp-ip:${clientIp(req)}`);
  if (!rl.success) {
    return new Response(JSON.stringify({ error: { code: "rate_limited", message: "Too many requests" } }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  return authedHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
