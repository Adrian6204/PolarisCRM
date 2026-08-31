import { Redis } from "@upstash/redis";
import { env, hasRedis } from "./env";

/**
 * Upstash Redis client (REST-based, so it works in stateless serverless
 * functions — no persistent socket held across invocations).
 *
 * Returns null when Upstash isn't configured (typical for local dev). Callers
 * must handle null and degrade gracefully rather than assuming a client.
 */
export const redis = hasRedis
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL as string,
      token: env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  : null;
