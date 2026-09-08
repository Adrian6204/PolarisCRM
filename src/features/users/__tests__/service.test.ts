import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";
import { createUser, updateUser, adminSetPassword, changeOwnPassword } from "../service";
import { verifyPassword } from "@/lib/auth";

/**
 * User-admin units with a mocked db. Focus: email-uniqueness, password hashing,
 * and the lock-out guardrails (self role/status, last active admin).
 */
function makeDb() {
  return {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("createUser", () => {
  it("rejects a duplicate email", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1" });
    await expect(
      createUser({ name: "A", email: "a@x.com", role: Role.team_member, password: "password1" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("stores a bcrypt hash, never the plaintext", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u2" });
    await createUser({ name: "B", email: "b@x.com", role: Role.admin, password: "supersecret" }, { db: db as never });
    const hash = db.user.create.mock.calls[0][0].data.passwordHash;
    expect(hash).not.toBe("supersecret");
    expect(await verifyPassword("supersecret", hash)).toBe(true);
  });
});

describe("updateUser guardrails", () => {
  beforeEach(() => {
    db.user.update.mockResolvedValue({ id: "u1" });
  });

  it("blocks changing your own role", async () => {
    db.user.findUnique.mockResolvedValue({ id: "me", role: Role.admin, active: true });
    await expect(updateUser("me", { role: Role.team_member }, "me", { db: db as never })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("blocks deactivating yourself", async () => {
    db.user.findUnique.mockResolvedValue({ id: "me", role: Role.admin, active: true });
    await expect(updateUser("me", { active: false }, "me", { db: db as never })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("blocks demoting the last active admin", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", role: Role.admin, active: true });
    db.user.count.mockResolvedValue(1);
    await expect(updateUser("u1", { role: Role.team_member }, "admin2", { db: db as never })).rejects.toMatchObject({ code: "conflict" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("allows demoting an admin when another active admin remains", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", role: Role.admin, active: true });
    db.user.count.mockResolvedValue(2);
    await updateUser("u1", { role: Role.team_member }, "admin2", { db: db as never });
    expect(db.user.update).toHaveBeenCalled();
  });

  it("allows a plain rename", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", role: Role.team_member, active: true });
    await updateUser("u1", { name: "New Name" }, "admin", { db: db as never });
    expect(db.user.update.mock.calls[0][0].data).toEqual({ name: "New Name" });
  });
});

describe("passwords", () => {
  it("adminSetPassword 404s when the user is gone", async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(adminSetPassword("gone", "password1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("changeOwnPassword rejects a wrong current password", async () => {
    db.user.findUnique.mockResolvedValue({ passwordHash: await (await import("@/lib/auth")).hashPassword("realpass1") });
    await expect(changeOwnPassword("u1", "wrongpass", "newpass12", { db: db as never })).rejects.toMatchObject({ code: "bad_request" });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
