import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomFieldType } from "@prisma/client";
import { coerceValue, createFieldDef, setClientCustomFields } from "../service";

/**
 * Custom-field units. Focus: per-type value coercion/validation, unique-key
 * derivation on create, and the bulk value-set (clear vs upsert, client guard,
 * unknown-field rejection).
 */
describe("coerceValue", () => {
  it("accepts and passes through text", () => {
    expect(coerceValue(CustomFieldType.text, "  hi ")).toBe("hi");
  });

  it("validates numbers", () => {
    expect(coerceValue(CustomFieldType.number, "42.5")).toBe("42.5");
    expect(() => coerceValue(CustomFieldType.number, "abc")).toThrow();
  });

  it("normalises dates to YYYY-MM-DD", () => {
    expect(coerceValue(CustomFieldType.date, "2026-03-04T10:00:00Z")).toBe("2026-03-04");
    expect(() => coerceValue(CustomFieldType.date, "not-a-date")).toThrow();
  });

  it("restricts booleans to true/false", () => {
    expect(coerceValue(CustomFieldType.boolean, "true")).toBe("true");
    expect(() => coerceValue(CustomFieldType.boolean, "yes")).toThrow();
  });

  it("validates urls", () => {
    expect(coerceValue(CustomFieldType.url, "https://x.com")).toBe("https://x.com");
    expect(() => coerceValue(CustomFieldType.url, "x.com")).toThrow();
  });

  it("restricts select values to the options", () => {
    expect(coerceValue(CustomFieldType.select, "Pro", ["Basic", "Pro"])).toBe("Pro");
    expect(() => coerceValue(CustomFieldType.select, "Gold", ["Basic", "Pro"])).toThrow();
  });
});

function makeDb() {
  return {
    client: { findFirst: vi.fn() },
    customFieldDef: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    clientCustomField: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
  db.clientCustomField.findMany.mockResolvedValue([]);
});

describe("createFieldDef", () => {
  it("derives a slug key and disambiguates collisions", async () => {
    db.customFieldDef.findUnique
      .mockResolvedValueOnce({ id: "x" }) // "account_manager" taken
      .mockResolvedValueOnce(null); // "account_manager_2" free
    db.customFieldDef.create.mockResolvedValue({ id: "f1" });
    await createFieldDef({ label: "Account Manager!", type: CustomFieldType.text, options: [], sortOrder: 0 }, { db: db as never });
    expect(db.customFieldDef.create.mock.calls[0][0].data.key).toBe("account_manager_2");
  });

  it("drops options for non-select types", async () => {
    db.customFieldDef.findUnique.mockResolvedValue(null);
    db.customFieldDef.create.mockResolvedValue({ id: "f1" });
    await createFieldDef({ label: "Tier", type: CustomFieldType.text, options: ["a", "b"], sortOrder: 0 }, { db: db as never });
    expect(db.customFieldDef.create.mock.calls[0][0].data.options).toEqual([]);
  });
});

describe("setClientCustomFields", () => {
  it("404s for a missing/soft-deleted client", async () => {
    db.client.findFirst.mockResolvedValue(null);
    await expect(
      setClientCustomFields("gone", { values: [] }, { db: db as never }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects an unknown field id", async () => {
    db.customFieldDef.findMany.mockResolvedValue([]);
    await expect(
      setClientCustomFields("cl1", { values: [{ fieldId: "nope", value: "x" }] }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.clientCustomField.upsert).not.toHaveBeenCalled();
  });

  it("upserts non-empty values and clears empty ones", async () => {
    db.customFieldDef.findMany.mockResolvedValue([
      { id: "f1", type: CustomFieldType.text, options: [] },
      { id: "f2", type: CustomFieldType.number, options: [] },
    ]);
    await setClientCustomFields(
      "cl1",
      { values: [{ fieldId: "f1", value: "hello" }, { fieldId: "f2", value: "" }] },
      { db: db as never },
    );
    expect(db.clientCustomField.upsert).toHaveBeenCalledTimes(1);
    expect(db.clientCustomField.upsert.mock.calls[0][0].create.value).toBe("hello");
    expect(db.clientCustomField.deleteMany).toHaveBeenCalledWith({ where: { clientId: "cl1", fieldId: "f2" } });
  });

  it("fails the whole batch on a bad-typed value", async () => {
    db.customFieldDef.findMany.mockResolvedValue([{ id: "f1", type: CustomFieldType.number, options: [] }]);
    await expect(
      setClientCustomFields("cl1", { values: [{ fieldId: "f1", value: "abc" }] }, { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.clientCustomField.upsert).not.toHaveBeenCalled();
  });
});
