import { describe, it, expect, vi, beforeEach } from "vitest";
import { search } from "../service";

/**
 * Search units with a mocked db. Focus: empty-query short-circuit, and that
 * each entity maps to the right type + navigable href.
 */
function makeDb() {
  return {
    client: { findMany: vi.fn().mockResolvedValue([]) },
    contact: { findMany: vi.fn().mockResolvedValue([]) },
    deal: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
});

describe("search", () => {
  it("returns nothing for a blank query without hitting the db", async () => {
    expect(await search("   ", { db: db as never })).toEqual([]);
    expect(db.client.findMany).not.toHaveBeenCalled();
  });

  it("maps each entity to a typed result with an href", async () => {
    db.client.findMany.mockResolvedValue([{ id: "c1", name: "Acme", industry: "SaaS" }]);
    db.contact.findMany.mockResolvedValue([{ id: "ct1", name: "Ada", email: "ada@x.com", clientId: "c1", client: { name: "Acme" } }]);
    db.deal.findMany.mockResolvedValue([{ id: "d1", title: "Retainer", client: { name: "Acme" } }]);
    db.project.findMany.mockResolvedValue([{ id: "p1", name: "Site", client: { name: "Acme" } }]);

    const out = await search("ac", { db: db as never });
    expect(out).toEqual([
      { type: "client", id: "c1", title: "Acme", subtitle: "SaaS", href: "/clients/c1" },
      { type: "contact", id: "ct1", title: "Ada", subtitle: "ada@x.com · Acme", href: "/clients/c1" },
      { type: "deal", id: "d1", title: "Retainer", subtitle: "Acme", href: "/deals/d1" },
      { type: "project", id: "p1", title: "Site", subtitle: "Acme", href: "/projects/p1" },
    ]);
  });
});
