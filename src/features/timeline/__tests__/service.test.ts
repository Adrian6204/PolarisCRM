import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Timeline merge units. The service reads the prisma singleton directly, so we
 * mock the module. Focus: activities + notes interleave into one reverse-chron
 * feed, actor falls back name→email→null, and the combined list is capped.
 */
const findManyActivity = vi.fn();
const findManyNote = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: { findMany: (...a: unknown[]) => findManyActivity(...a) },
    note: { findMany: (...a: unknown[]) => findManyNote(...a) },
  },
}));

import { getClientTimeline } from "../service";

beforeEach(() => {
  findManyActivity.mockReset();
  findManyNote.mockReset();
});

describe("getClientTimeline", () => {
  it("merges activities and notes newest-first", async () => {
    findManyActivity.mockResolvedValue([
      {
        id: "a1",
        createdAt: new Date("2026-01-02T10:00:00Z"),
        type: "call",
        summary: "Call",
        createdBy: { name: "Ada", email: "ada@x.com" },
        project: { id: "p1", name: "Site" },
      },
    ]);
    findManyNote.mockResolvedValue([
      {
        id: "n1",
        createdAt: new Date("2026-01-03T10:00:00Z"),
        body: "Note body",
        createdBy: { name: null, email: "bob@x.com" },
      },
    ]);

    const events = await getClientTimeline("cl1");
    expect(events.map((e) => e.id)).toEqual(["n1", "a1"]); // newest first
    expect(events[0]).toMatchObject({ kind: "note", actor: "bob@x.com" });
    expect(events[1]).toMatchObject({ kind: "activity", actor: "Ada", project: { id: "p1", name: "Site" } });
  });

  it("caps the merged feed at the limit", async () => {
    findManyActivity.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `a${i}`,
        createdAt: new Date(2026, 0, 1, i),
        type: "note",
        summary: "x",
        createdBy: null,
        project: null,
      })),
    );
    findManyNote.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `n${i}`,
        createdAt: new Date(2026, 0, 2, i),
        body: "y",
        createdBy: null,
      })),
    );
    const events = await getClientTimeline("cl1", 4);
    expect(events).toHaveLength(4);
    expect(events[0].kind).toBe("note"); // notes are newer
    expect(events.every((e) => e.actor === null)).toBe(true);
  });
});
