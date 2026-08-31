import * as Sentry from "@sentry/nextjs";

// Initializes only when a DSN is present, so local/dev without Sentry is a no-op.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
