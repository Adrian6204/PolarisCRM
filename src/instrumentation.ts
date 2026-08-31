/**
 * Next.js instrumentation hook — loads the right Sentry config per runtime.
 * No-ops when Sentry isn't configured (the config files self-gate on DSN).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
