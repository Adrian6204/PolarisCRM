import { describe, it, expect } from "vitest";
import { paginationSchema, toSkipTake, optionalText } from "../validation";

describe("paginationSchema", () => {
  it("applies defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  it("coerces query-string numbers", () => {
    expect(paginationSchema.parse({ page: "3", pageSize: "10" })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it("rejects out-of-range pageSize", () => {
    expect(() => paginationSchema.parse({ pageSize: "1000" })).toThrow();
  });
});

describe("toSkipTake", () => {
  it("computes skip/take from page", () => {
    expect(toSkipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe("optionalText", () => {
  it("treats empty string as undefined", () => {
    expect(optionalText().parse("")).toBeUndefined();
    expect(optionalText().parse("  ")).toBeUndefined();
  });

  it("trims content", () => {
    expect(optionalText().parse("  hi  ")).toBe("hi");
  });
});
