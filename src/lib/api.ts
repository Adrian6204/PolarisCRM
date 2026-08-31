import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requestLogger, type Logger } from "./logger";
import { errorResponse, ApiError } from "./errors";
import { enforceRateLimit } from "./ratelimit";

/**
 * Context passed to every route handler. Carries the per-request logger and a
 * requestId that also comes back on every response (success or error) so a
 * client report can be traced to a specific log line.
 */
export interface ApiContext {
  requestId: string;
  log: Logger;
  req: NextRequest;
  /** Route params (from the App Router `{ params }` arg), if any. */
  params: Record<string, string | string[]>;
}

interface RouteConfig {
  /** Rate-limit tier for this route. Omit for no limiting (internal reads). */
  rateLimit?: "auth" | "write" | "read";
}

type Handler = (ctx: ApiContext) => Promise<NextResponse> | Promise<Response>;

/**
 * Wrap an App Router route handler with the cross-cutting concerns every route
 * needs (see SPEC "Cross-Cutting Requirements"):
 *   - assigns/propagates a requestId (honours inbound `x-request-id`)
 *   - request-scoped structured logging
 *   - optional rate limiting scoped by sensitivity
 *   - uniform error handling + Sentry reporting for unexpected errors
 *
 * Auth and input validation are performed *inside* the handler via
 * requireUser/requireRole and parseJson/parseQuery, which throw typed errors
 * this wrapper renders consistently.
 */
export function withApiRoute(handler: Handler, config: RouteConfig = {}) {
  return async (
    req: NextRequest,
    // Next 15 App Router passes params as a Promise on the second arg.
    routeCtx: { params: Promise<Record<string, string | string[]>> },
  ): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const log = requestLogger(requestId, {
      method: req.method,
      path: new URL(req.url).pathname,
    });
    const started = Date.now();

    try {
      if (config.rateLimit) {
        const id = clientIdentifier(req);
        const rl = await enforceRateLimit(config.rateLimit, id);
        if (!rl.success) {
          log.warn({ tier: config.rateLimit, id }, "rate limit exceeded");
          throw new ApiError("rate_limited", "Too many requests");
        }
      }

      log.debug("request start");
      const res = await handler({
        requestId,
        log,
        req,
        params: (await routeCtx?.params) ?? {},
      });
      res.headers.set("x-request-id", requestId);
      log.info({ status: res.status, ms: Date.now() - started }, "request complete");
      return res;
    } catch (err) {
      // Only report genuinely unexpected errors to Sentry — expected ApiErrors
      // (auth, validation, not-found) are normal control flow, not incidents.
      const isExpected =
        err instanceof ApiError || err instanceof z.ZodError;
      if (!isExpected) {
        Sentry.captureException(err, { tags: { requestId } });
        log.error({ err }, "unhandled error");
      } else {
        log.info({ err: String(err) }, "request rejected");
      }
      return errorResponse(err, requestId);
    }
  };
}

/** Derive a rate-limit identifier from the request (proxy-aware). */
function clientIdentifier(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Parse & validate a JSON body against a Zod schema (throws ZodError). */
export async function parseJson<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}

/** Parse & validate the query string against a Zod schema (throws ZodError). */
export function parseQuery<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): z.infer<T> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return schema.parse(params);
}

/** Standard success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}
