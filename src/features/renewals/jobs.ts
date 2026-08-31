import { inngest, EVENTS } from "@/lib/inngest";
import { logger } from "@/lib/logger";
import { getUpcomingRenewals } from "./service";

/** How far ahead the daily scan looks for renewals. */
export const RENEWAL_SCAN_WINDOW_DAYS = 30;

/**
 * Daily scan for upcoming retainer renewals (SPEC Phase 5).
 *
 * Two triggers:
 *   - `cron` — Inngest's own scheduler runs it daily at 08:00 UTC even without
 *     any external cron, which keeps it working in Inngest Cloud / dev.
 *   - `event` — the Vercel Cron endpoint (/api/cron/scan-renewals) emits
 *     `renewals/scan.requested`, satisfying the "triggered via Vercel Cron"
 *     requirement in environments where Vercel Cron is the scheduler.
 *
 * The scan logs upcoming renewals (structured) and returns a summary. Sending
 * actual notifications (email/Slack) is a deliberate future extension — the
 * hook is here.
 */
export const scanRetainerRenewals = inngest.createFunction(
  {
    id: "scan-retainer-renewals",
    name: "Scan retainer renewals",
    // inngest v4: triggers live in the options object (cron + event).
    triggers: [
      { cron: "TZ=UTC 0 8 * * *" },
      { event: EVENTS.renewalsScanRequested },
    ],
  },
  async ({ step }) => {
    const renewals = await step.run("query-upcoming-renewals", async () => {
      const upcoming = await getUpcomingRenewals(RENEWAL_SCAN_WINDOW_DAYS);
      return upcoming.map((r) => ({
        projectId: r.id,
        project: r.name,
        clientId: r.client.id,
        client: r.client.name,
        renewalDate: r.retainerRenewalDate,
        daysUntil: r.daysUntil,
      }));
    });

    logger.info(
      { count: renewals.length, windowDays: RENEWAL_SCAN_WINDOW_DAYS },
      "retainer renewal scan complete",
    );
    for (const r of renewals) {
      logger.info(r, "retainer renewal upcoming");
    }

    // TODO(notifications): emit per-owner reminders here (email/Slack) once a
    // notification channel exists.
    return { scanned: renewals.length, windowDays: RENEWAL_SCAN_WINDOW_DAYS, renewals };
  },
);
