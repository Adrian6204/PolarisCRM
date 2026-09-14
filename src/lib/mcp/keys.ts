import { createHash, randomBytes } from "node:crypto";

/**
 * API-key crypto for the MCP server. Keys are bearer tokens of the form
 *
 *   pcrm_<43 url-safe base64 chars>   (256 bits of entropy)
 *
 * Only the SHA-256 hash is ever persisted (see the ApiKey model); the raw key
 * is returned once at creation and shown to the user a single time. SHA-256,
 * not bcrypt, is deliberate here: the token is high-entropy random, so there
 * is nothing to brute-force, and lookups must be a single indexed equality on
 * the hash (bcrypt's per-row salt would force a full scan).
 */
const PREFIX = "pcrm_";
/** Chars of the raw key kept for display, e.g. "pcrm_A1b2". */
const DISPLAY_LEN = PREFIX.length + 4;

export interface GeneratedKey {
  /** The full secret, returned once, never stored. */
  raw: string;
  /** SHA-256 hex of `raw`; this is what the DB stores and looks up on. */
  hash: string;
  /** Short human-facing fragment stored alongside the hash. */
  prefix: string;
}

/** Mint a new API key. */
export function generateApiKey(): GeneratedKey {
  const raw = PREFIX + randomBytes(32).toString("base64url");
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, DISPLAY_LEN) };
}

/** SHA-256 hex of a raw key, the value stored and queried in `api_keys.hash`. */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Cheap shape check before hitting the DB. */
export function looksLikeApiKey(raw: string): boolean {
  return raw.startsWith(PREFIX) && raw.length > DISPLAY_LEN;
}
