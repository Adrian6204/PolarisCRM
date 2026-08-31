import { Inngest } from "inngest";
import { env } from "./env";

/**
 * Inngest client — the event bus for background/scheduled jobs.
 *
 * Serverless-native: functions are registered on a route (/api/inngest) and
 * invoked by Inngest over HTTP; no long-running worker. Locally the Inngest dev
 * server (`npx inngest-cli dev`) discovers that route and needs no keys.
 */
export const inngest = new Inngest({
  id: "polaris-crm",
  eventKey: env.INNGEST_EVENT_KEY,
});

/** Event names, centralized so producers and consumers can't drift. */
export const EVENTS = {
  renewalsScanRequested: "renewals/scan.requested",
} as const;
