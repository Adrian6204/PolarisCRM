import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", h)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", h)).toBe(false);
  });

  it("rejects against a malformed hash without throwing", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});
