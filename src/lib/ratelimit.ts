import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";
import { logger } from "./logger";

/**
 * Rate limiting, scoped by sensitivity rather than applied blanket (see SPEC).
 * Three tiers; routes opt into the one that matches their risk:
 *
 *   - `auth`   strict — login / credential routes (brute-force surface)
 *   - `write`  moderate — create/update/delete routes
 *   - `read`   light — internal read routes (generous until usage says otherwise)
 *
 * Uses a sliding window on Upstash. When Redis isn't configured (local dev),
 * limiters are null and `enforceRateLimit` degrades open.
 */
type Tier = "auth" | "write" | "read";

function make(tier: Tier, limiter: ConstructorParameters<typeof Ratelimit>[0]["limiter"]) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter,
    prefix: `rl:${tier}`,
    analytics: true,
  });
}

const limiters: Record<Tier, Ratelimit | null> = {
  auth: make("auth", Ratelimit.slidingWindow(5, "1 m")),
  write: make("write", Ratelimit.slidingWindow(30, "10 s")),
  read: make("read", Ratelimit.slidingWindow(100, "10 s")),
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Enforce the given tier for an identifier (typically IP, or user id for
 * authenticated write routes). Degrades open — allowing the request — when
 * Redis is unconfigured, logging a warning once per cold start would be noisy
 * so we log at debug level.
 */
export async function enforceRateLimit(
  tier: Tier,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = limiters[tier];
  if (!limiter) {
    logger.debug({ tier }, "rate limit skipped — Redis not configured");
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const res = await limiter.limit(identifier);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: res.reset,
  };
}
