import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContactRole } from "@prisma/client";
import {
  createContact,
  deleteContact,
  updateContact,
} from "../service";

/**
 * Unit tests for the contact service, focused on the "at most one primary per
 * client" invariant and client-scoped 404s. The injected `db` doubles as the
 * transaction client, so no $transaction wrapping is exercised here.
 */
function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    contact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" }); // client active by default
});

const base = { name: "Jane", email: "jane@acme.com", role: ContactRole.billing };

describe("createContact", () => {
  it("demotes existing primaries when the new contact is primary", async () => {
    db.contact.create.mockResolvedValue({ id: "ct1", isPrimary: true });
    await createContact("cl1", { ...base, isPrimary: true }, { db: db as never });

    expect(db.contact.updateMany).toHaveBeenCalledWith({
      where: { clientId: "cl1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(db.contact.create).toHaveBeenCalled();
  });

  it("does not demote when the new contact is not primary", async () => {
    db.contact.create.mockResolvedValue({ id: "ct1", isPrimary: false });
    await createContact("cl1", { ...base, isPrimary: false }, { db: db as never });
    expect(db.contact.updateMany).not.toHaveBeenCalled();
  });

  it("404s when the parent client is missing/soft-deleted", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      createContact("gone", { ...base, isPrimary: false }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.contact.create).not.toHaveBeenCalled();
  });
});

describe("updateContact", () => {
  it("404s when the contact does not belong to the client", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    await expect(
      updateContact("cl1", "ctX", { name: "New" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("demotes other primaries but keeps the updated contact primary", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "ct1" });
    db.contact.update.mockResolvedValue({ id: "ct1", isPrimary: true });
    await updateContact("cl1", "ct1", { isPrimary: true }, { db: db as never });

    expect(db.contact.updateMany).toHaveBeenCalledWith({
      where: { clientId: "cl1", isPrimary: true, NOT: { id: "ct1" } },
      data: { isPrimary: false },
    });
  });
});

describe("deleteContact", () => {
  it("scopes the delete to the client and 404s on no match", async () => {
    db.contact.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      deleteContact("cl1", "ctX", { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(db.contact.deleteMany).toHaveBeenCalledWith({
      where: { id: "ctX", clientId: "cl1" },
    });
  });

  it("succeeds when a row is deleted", async () => {
    db.contact.deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      deleteContact("cl1", "ct1", { db: db as never }),
    ).resolves.toBeUndefined();
  });
});
