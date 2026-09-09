import { describe, it, expect, vi, beforeEach } from "vitest";
import { importClients } from "../service";

/**
 * Client CSV import units with a mocked db + createFn. Focus: header mapping,
 * per-row validation, skip-existing-by-name, and error reporting by row number.
 */
function makeDb(existingNames: string[] = []) {
  return {
    client: {
      findFirst: vi.fn(async ({ where }: { where: { name: { equals: string } } }) =>
        existingNames.some((n) => n.toLowerCase() === where.name.equals.toLowerCase()) ? { id: "x" } : null,
      ),
    },
  };
}

let created: string[];
const createFn = vi.fn(async (input: { name: string }) => {
  created.push(input.name);
  return { id: `id-${input.name}` };
});

beforeEach(() => {
  created = [];
  createFn.mockClear();
});

describe("importClients", () => {
  it("creates valid rows and maps common header spellings", async () => {
    const db = makeDb();
    const rows: Record<string, string>[] = [
      { name: "Acme", industry: "SaaS", website: "https://acme.com", status: "prospect" },
      { Name: "Globex", URL: "https://globex.com" }, // alt header casings/keys
    ];
    const res = await importClients(rows, createFn, { db: db as never });
    expect(res.created).toBe(2);
    expect(created).toEqual(["Acme", "Globex"]);
  });

  it("skips rows whose name already exists", async () => {
    const db = makeDb(["Acme"]);
    const res = await importClients([{ name: "Acme" }], createFn, { db: db as never });
    expect(res).toMatchObject({ created: 0, skipped: 1 });
    expect(createFn).not.toHaveBeenCalled();
  });

  it("reports invalid rows by 1-based sheet row, without aborting", async () => {
    const db = makeDb();
    const rows = [
      { name: "" }, // invalid — empty name (sheet row 2)
      { name: "Valid Co" }, // ok (sheet row 3)
    ];
    const res = await importClients(rows, createFn, { db: db as never });
    expect(res.created).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].row).toBe(2);
  });

  it("rejects a bad website URL", async () => {
    const db = makeDb();
    const res = await importClients([{ name: "Acme", website: "not-a-url" }], createFn, { db: db as never });
    expect(res.created).toBe(0);
    expect(res.errors[0].message).toMatch(/url/i);
  });
});
