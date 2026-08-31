import pino from "pino";
import { env, isProd } from "./env";

/**
 * Structured logger (Pino). In production emits newline-delimited JSON that
 * Vercel's log drains ingest directly; in dev it pretty-prints.
 *
 * Every request should log through a child logger carrying a `requestId` so
 * lines can be correlated — see `requestLogger()` and withApiRoute().
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  // pino-pretty is a dev-only transport; never load it in serverless prod.
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
      },
  base: undefined, // drop pid/hostname noise — not meaningful in serverless
});

/** Build a request-scoped child logger. */
export function requestLogger(requestId: string, extra?: Record<string, unknown>) {
  return logger.child({ requestId, ...extra });
}

export type Logger = typeof logger;
