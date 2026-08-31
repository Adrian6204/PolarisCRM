import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Run `fn` against a transaction. If a db client is injected (a test mock, or
 * an already-open transaction), reuse it directly — Postgres can't nest
 * transactions, and tests pass a mock. Otherwise open a real transaction on the
 * singleton.
 *
 * Used by write services so a mutation and its audit row commit atomically
 * (Phase 9): if the audit insert fails, the whole write rolls back — no change
 * is ever persisted without its audit record.
 */
export function runInTx<T>(
  db: Db | undefined,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  if (db) return fn(db);
  return prisma.$transaction((tx) => fn(tx));
}
