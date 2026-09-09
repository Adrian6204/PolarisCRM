import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "../csv";

/** CSV round-trip + edge cases: quoting, embedded commas/newlines, blank rows. */
describe("toCsv", () => {
  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(["name", "note"], [["Acme, Inc", 'He said "hi"'], ["Multi", "a\nb"]]);
    expect(csv).toBe('name,note\r\n"Acme, Inc","He said ""hi"""\r\nMulti,"a\nb"');
  });
});

describe("parseCsv", () => {
  it("parses a header + rows into objects", () => {
    const rows = parseCsv("name,status\nAcme,active\nGlobex,prospect");
    expect(rows).toEqual([
      { name: "Acme", status: "active" },
      { name: "Globex", status: "prospect" },
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('name,note\n"Acme, Inc","a ""b"" c"');
    expect(rows[0]).toEqual({ name: "Acme, Inc", note: 'a "b" c' });
  });

  it("drops blank lines and trims headers/values", () => {
    const rows = parseCsv("name , status\nAcme , active\n\n");
    expect(rows).toEqual([{ name: "Acme", status: "active" }]);
  });

  it("round-trips with toCsv", () => {
    const csv = toCsv(["name", "website"], [["Acme", "https://a.com"]]);
    expect(parseCsv(csv)).toEqual([{ name: "Acme", website: "https://a.com" }]);
  });
});
