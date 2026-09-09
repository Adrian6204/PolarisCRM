import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { inngest, EVENTS } from "@/lib/inngest";
import { requestLogger } from "@/lib/logger";
import { env, isProd } from "@/lib/env";

/**
 * Vercel Cron target for the reminder scan. Emits `reminders/scan.requested`;
 * Inngest fans it out to the scan function (which owns retries/durability).
 * Same auth as the renewals cron: requires `Bearer $CRON_SECRET` in prod.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = randomUUID();
  const log = requestLogger(requestId, { route: "cron/scan-reminders" });

  const auth = req.headers.get("authorization");
  if (env.CRON_SECRET) {
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      log.warn("cron: rejected unauthorized request");
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Invalid cron secret" }, requestId },
        { status: 401 },
      );
    }
  } else if (isProd) {
    log.error("cron: CRON_SECRET is not set in production");
    return NextResponse.json(
      { error: { code: "internal_error", message: "Cron not configured" }, requestId },
      { status: 500 },
    );
  }

  await inngest.send({ name: EVENTS.remindersScanRequested, data: { requestId } });
  log.info("cron: enqueued reminder scan");
  return NextResponse.json({ data: { enqueued: true }, requestId });
}
