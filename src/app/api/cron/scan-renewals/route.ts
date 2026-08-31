import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { inngest, EVENTS } from "@/lib/inngest";
import { requestLogger } from "@/lib/logger";
import { env, isProd } from "@/lib/env";

/**
 * Vercel Cron target (scheduled in vercel.json). Emits the
 * `renewals/scan.requested` event, which Inngest fans out to the scan function.
 * Kept thin on purpose: Cron triggers the event; Inngest owns retries/durability.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. We require it in
 * production so the endpoint can't be triggered by the public; locally it's
 * open when CRON_SECRET is unset for easy testing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = randomUUID();
  const log = requestLogger(requestId, { route: "cron/scan-renewals" });

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
    // Fail closed in production if the secret was never configured.
    log.error("cron: CRON_SECRET is not set in production");
    return NextResponse.json(
      { error: { code: "internal_error", message: "Cron not configured" }, requestId },
      { status: 500 },
    );
  }

  await inngest.send({ name: EVENTS.renewalsScanRequested, data: { requestId } });
  log.info("cron: enqueued renewal scan");
  return NextResponse.json({ data: { enqueued: true }, requestId });
}
