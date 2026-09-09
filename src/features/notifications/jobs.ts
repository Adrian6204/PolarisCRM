import { inngest, EVENTS } from "@/lib/inngest";
import { logger } from "@/lib/logger";
import { generateReminders } from "./service";

/**
 * Periodic reminder scan (P4). Creates in-app notifications for appointments
 * starting soon and overdue tasks. Idempotent via dedupeKey, so running it
 * hourly never duplicates.
 *
 * Two triggers, mirroring the renewals job: Inngest's own cron (works in
 * Inngest Cloud/dev with no external scheduler) and a `reminders/scan.requested`
 * event emitted by the Vercel Cron endpoint.
 */
export const scanReminders = inngest.createFunction(
  {
    id: "scan-reminders",
    name: "Scan reminders",
    triggers: [{ cron: "TZ=UTC 0 * * * *" }, { event: EVENTS.remindersScanRequested }],
  },
  async ({ step }) => {
    const result = await step.run("generate-reminders", () => generateReminders({ log: logger }));
    return result;
  },
);
