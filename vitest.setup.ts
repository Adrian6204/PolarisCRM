/**
 * Test environment defaults. Provides the minimum env vars env.ts requires so
 * importing app modules under test doesn't fail the boot-time validation.
 * Individual tests can override these as needed.
 */
// `NODE_ENV` is typed read-only by Next's env augmentation; write through a
// widened view of process.env for the test-only defaults.
const testEnv = process.env as Record<string, string | undefined>;
testEnv.NODE_ENV ??= "test";
testEnv.DATABASE_URL ??= "postgresql://polaris:polaris@localhost:5432/polaris_crm_test?schema=public";
testEnv.NEXTAUTH_SECRET ??= "test-secret-not-for-production-use-only";
