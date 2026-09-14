import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateApiKey, hashKey, looksLikeApiKey } from "../keys";

/**
 * API-key crypto: keys are high-entropy, prefixed, and only ever stored as a
 * SHA-256 hash. These lock in the format the resolver and DB depend on.
 */
describe("generateApiKey", () => {
  it("mints a prefixed key whose hash and prefix match the raw value", () => {
    const { raw, hash, prefix } = generateApiKey();
    expect(raw.startsWith("pcrm_")).toBe(true);
    expect(prefix).toBe(raw.slice(0, 9)); // "pcrm_" + 4 chars
    expect(hash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(hash).toHaveLength(64);
  });

  it("produces unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashKey", () => {
  it("is deterministic", () => {
    expect(hashKey("pcrm_abc")).toBe(hashKey("pcrm_abc"));
    expect(hashKey("pcrm_abc")).not.toBe(hashKey("pcrm_abd"));
  });
});

describe("looksLikeApiKey", () => {
  it("accepts well-formed keys and rejects everything else", () => {
    expect(looksLikeApiKey(generateApiKey().raw)).toBe(true);
    expect(looksLikeApiKey("pcrm_")).toBe(false); // prefix only, no body
    expect(looksLikeApiKey("nope")).toBe(false);
    expect(looksLikeApiKey("")).toBe(false);
  });
});
