import { redis } from "./redis";
import { logger } from "./logger";

/**
 * Small caching layer over Upstash Redis (SPEC Phase 6). Applied deliberately
 * to read-heavy dashboard/report views, NOT blanket. Every cache is paired with
 * explicit invalidation on writes to the underlying data — the guard against
 * the stale-data bugs the SPEC calls out.
 *
 * Degrades open: when Redis isn't configured, or a cache op fails, we fall
 * straight through to the source of truth rather than error. Correctness never
 * depends on the cache being up.
 *
 * @upstash/redis serializes/deserializes JSON automatically, so values round-
 * trip as plain objects.
 */

/** Centralized cache keys so producers and invalidators can't drift. */
export const cacheKeys = {
  dashboardServiceLines: "cache:dashboard:service-lines",
  clientReports: (clientId: string) => `cache:client:${clientId}:reports`,
} as const;

/** Read-through cache: return the cached value or compute, store, and return. */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (!redis) return compute();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      logger.debug({ key }, "cache hit");
      return cached;
    }
  } catch (err) {
    logger.warn({ err, key }, "cache read failed — falling through");
  }

  const fresh = await compute();

  try {
    await redis.set(key, fresh, { ex: ttlSeconds });
    logger.debug({ key, ttlSeconds }, "cache set");
  } catch (err) {
    logger.warn({ err, key }, "cache write failed");
  }
  return fresh;
}

/** Explicitly invalidate one or more keys after a write. No-op without Redis. */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
    logger.debug({ keys }, "cache invalidated");
  } catch (err) {
    logger.warn({ err, keys }, "cache invalidation failed");
  }
}
