import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth";

describe("password hashing (bcrypt)", () => {
  it("produces a bcrypt hash and verifies the correct password", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(h).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    expect(await verifyPassword("correct horse battery staple", h)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", h)).toBe(false);
  });

  it("rejects against a malformed hash without throwing", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});
