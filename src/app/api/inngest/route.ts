import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { scanRetainerRenewals } from "@/features/renewals/jobs";

/**
 * Inngest's function endpoint. Inngest (cloud or the local dev server) discovers
 * and invokes registered functions here over HTTP — no long-running worker,
 * which is what makes this serverless-safe.
 */
// The signing key is read from INNGEST_SIGNING_KEY in the environment.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanRetainerRenewals],
});
