import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasStorage } from "./env";
import { ApiError } from "./errors";

/**
 * Supabase Storage access for file attachments. Uses the service-role key
 * server-side only (bypasses storage RLS), with a private bucket. Browsers
 * never see the key — uploads go through short-lived signed upload URLs and
 * downloads through short-lived signed download URLs.
 *
 * Optional: when unconfigured, callers get a clean "not configured" 400 rather
 * than a crash (mirrors the Redis/Inngest optional-service pattern).
 */
export const ATTACHMENTS_BUCKET = "attachments";

let client: SupabaseClient | null = null;

function storage() {
  if (!hasStorage) throw ApiError.badRequest("File storage is not configured");
  if (!client) {
    client = createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return client.storage.from(ATTACHMENTS_BUCKET);
}

/**
 * A signed URL the browser uses to upload directly to Storage. The token is
 * embedded in `signedUrl`, so the browser can PUT the file to it with no key.
 */
export async function createSignedUpload(path: string) {
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) throw ApiError.badRequest(error?.message ?? "Could not create upload URL");
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

/** A short-lived signed URL to download/preview a stored object. */
export async function createSignedDownload(path: string, expiresInSeconds = 60) {
  const { data, error } = await storage().createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw ApiError.notFound("File not found");
  return data.signedUrl;
}

/** Remove an object from Storage (best-effort; ignores missing). */
export async function removeObject(path: string) {
  await storage().remove([path]);
}
