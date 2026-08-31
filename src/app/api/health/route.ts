import { withApiRoute, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasRedis } from "@/lib/env";
import { redis } from "@/lib/redis";

/**
 * Liveness/readiness probe. Reports DB connectivity and whether Redis is wired.
 * Intentionally unauthenticated and un-rate-limited so uptime checks and the
 * platform can hit it freely. Returns 200 when the DB is reachable, 503 if not.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ log }) => {
  const checks: Record<string, "ok" | "down" | "unconfigured"> = {
    database: "down",
    redis: hasRedis ? "down" : "unconfigured",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    log.error({ err }, "health: database check failed");
  }

  if (redis) {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch (err) {
      log.error({ err }, "health: redis check failed");
    }
  }

  const healthy = checks.database === "ok";
  return ok(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
});
