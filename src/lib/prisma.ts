import { PrismaClient } from "@prisma/client";
import { isProd } from "./env";

/**
 * Prisma client singleton.
 *
 * Serverless functions can be invoked repeatedly on a warm instance; without a
 * singleton, dev hot-reload and warm invocations would open a new pool each
 * time and exhaust connections. In production each function instance keeps one
 * client; the actual connection fan-out is handled by the pooler pointed at by
 * DATABASE_URL (Neon/Supabase pooler or PgBouncer), not by Prisma itself.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["error", "warn"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
