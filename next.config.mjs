import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
/** Baseline security headers applied to every response (Phase 9 hardening). */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the tracing root to this project so serverless file tracing isn't
  // confused by lockfiles higher up the filesystem.
  outputFileTracingRoot: import.meta.dirname,
  // Keep native/server-only packages out of the client/edge bundle so the
  // Prisma engine and Pino resolve correctly under serverless.
  serverExternalPackages: ["@prisma/client", "pino", "pino-pretty"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Sentry is optional in local/dev — only wrap when a DSN is configured so the
// build doesn't fail without Sentry credentials.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : nextConfig;
