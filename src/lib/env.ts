import { z } from "zod";

/**
 * Centralized, validated environment access. Import `env` instead of reading
 * `process.env` directly so a missing/malformed var fails fast at boot with a
 * clear message rather than surfacing as an obscure runtime error later.
 *
 * Optional-in-dev services (Upstash, Sentry) are typed as optional here; the
 * modules that consume them degrade gracefully when they're absent locally.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n` +
        `See .env.example for the expected shape.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** True when Upstash Redis is configured (rate limiting + caching active). */
export const hasRedis = Boolean(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
);
