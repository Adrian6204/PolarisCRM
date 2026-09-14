import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import * as Sentry from "@sentry/nextjs";
import type { Role } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { assertRole } from "@/lib/auth";
import { logger, type Logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/ratelimit";
import type { McpActor } from "./auth";

/**
 * Shared plumbing for MCP tools. A tool is a thin adapter: it authenticates via
 * the actor carried on the request's AuthInfo, enforces the *same* role gate the
 * matching HTTP route uses, then delegates to an existing feature service, so
 * audit logging and automations fire exactly as they do for the web app.
 */

/**
 * The MCP tool result envelope (text content). The index signature mirrors the
 * SDK's `CallToolResult` shape (it permits arbitrary extra keys like `_meta`).
 */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [x: string]: unknown;
}

/** The `extra` arg the SDK passes to a tool callback, narrowed to what we read. */
interface ToolExtra {
  authInfo?: { extra?: Record<string, unknown> };
}

/** Pull the authenticated actor off the request, or throw 401. */
export function getActor(extra: ToolExtra): McpActor {
  const actor = extra.authInfo?.extra?.actor as McpActor | undefined;
  if (!actor) throw ApiError.unauthorized();
  return actor;
}

/** WriteOpts every write service accepts, attributes the change to the actor. */
export function writeOpts(actor: McpActor, log: Logger) {
  return { actorId: actor.id, log };
}

/** Format any JSON-serializable value as a text tool result. */
export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Plain-text tool result (used for confirmation prompts and notices). */
export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

type Tier = "read" | "write";

interface GuardConfig {
  /** Roles allowed to call the tool. Omit to allow any authenticated user. */
  roles?: Role[];
  /** Rate-limit tier, keyed on the API key. Defaults to "read". */
  tier?: Tier;
}

/**
 * Wrap a tool handler with auth, role enforcement, rate limiting, and uniform
 * error handling. The handler receives the resolved actor and a request-scoped
 * logger; expected errors (auth/validation/not-found) come back as `isError`
 * results the model can act on, while unexpected errors are reported to Sentry
 * and returned as a generic failure without leaking internals.
 */
export function guard<Args>(
  name: string,
  config: GuardConfig,
  handler: (args: Args, ctx: { actor: McpActor; log: Logger }) => Promise<ToolResult>,
) {
  return async (args: Args, extra: ToolExtra): Promise<ToolResult> => {
    const log = logger.child({ mcpTool: name });
    try {
      const actor = getActor(extra);
      if (config.roles) assertRole(actor.role, ...config.roles);

      const rl = await enforceRateLimit(config.tier ?? "read", `mcp:${actor.keyId}`);
      if (!rl.success) throw new ApiError("rate_limited", "Too many requests");

      log.debug({ actorId: actor.id, role: actor.role }, "mcp tool invoked");
      return await handler(args, { actor, log });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return { isError: true, ...textResult(`Validation failed: ${JSON.stringify(err.flatten())}`) };
      }
      if (err instanceof ApiError) {
        return { isError: true, ...textResult(`${err.code}: ${err.message}`) };
      }
      Sentry.captureException(err, { tags: { mcpTool: name } });
      log.error({ err }, "mcp tool unhandled error");
      return { isError: true, ...textResult("Internal error") };
    }
  };
}

/**
 * Unwrap a feature Zod schema to the ZodRawShape the SDK needs for a tool's
 * inputSchema. Feature schemas are often ZodObjects wrapped in ZodEffects
 * (`.refine`/`.superRefine`); the cross-field refinements they carry aren't
 * expressible in JSON Schema and are re-applied when the handler calls the full
 * schema's `.parse()`. Extra fields (e.g. a path-derived `clientId`) can be
 * merged on via the second argument.
 */
export function toShape(schema: ZodTypeAny, extra: ZodRawShape = {}): ZodRawShape {
  let s: ZodTypeAny = schema;
  // Peel ZodEffects/ZodDefault/ZodOptional wrappers down to the ZodObject.
  while (s && !("shape" in (s as { shape?: unknown })) && (s as { _def?: { schema?: ZodTypeAny; innerType?: ZodTypeAny } })._def) {
    const def = (s as { _def: { schema?: ZodTypeAny; innerType?: ZodTypeAny } })._def;
    s = (def.schema ?? def.innerType) as ZodTypeAny;
    if (!s) break;
  }
  const shape = (s as unknown as { shape?: ZodRawShape })?.shape ?? {};
  return { ...shape, ...extra };
}
