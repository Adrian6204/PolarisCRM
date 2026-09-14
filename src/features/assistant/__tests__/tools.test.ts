import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Assistant tool dispatcher: maps a tool name + args to the right read service
 * and shapes a compact result. Services are mocked so these stay unit tests.
 */
const search = vi.fn();
vi.mock("@/features/search/service", () => ({ search: (...a: unknown[]) => search(...a) }));

const listClients = vi.fn();
const getClient = vi.fn();
vi.mock("@/features/clients/service", () => ({
  listClients: (...a: unknown[]) => listClients(...a),
  getClient: (...a: unknown[]) => getClient(...a),
}));

import { dispatchTool, assistantTools } from "../tools";
import { ApiError } from "@/lib/errors";

beforeEach(() => {
  search.mockReset();
  listClients.mockReset();
  getClient.mockReset();
});

describe("assistantTools", () => {
  it("exposes named, read-only function specs", () => {
    const names = assistantTools.map((t) => t.function.name);
    expect(names).toEqual(
      expect.arrayContaining(["search_crm", "list_clients", "get_client", "list_upcoming_renewals"]),
    );
    for (const t of assistantTools) {
      expect(t.type).toBe("function");
      expect(t.function.name).toBeTruthy();
      expect(t.function.parameters).toBeTruthy();
    }
  });
});

describe("dispatchTool", () => {
  it("maps search_crm results to compact rows", async () => {
    search.mockResolvedValue([
      { type: "client", id: "c1", title: "Acme", subtitle: "SaaS", href: "/clients/c1" },
    ]);
    const out = await dispatchTool("search_crm", { query: "Acme" });
    expect(search).toHaveBeenCalledWith("Acme", { perType: 5 });
    expect(out).toEqual([{ type: "client", id: "c1", title: "Acme", subtitle: "SaaS" }]);
  });

  it("requires a non-empty query for search_crm", async () => {
    expect(await dispatchTool("search_crm", { query: "  " })).toMatchObject({ error: expect.any(String) });
    expect(search).not.toHaveBeenCalled();
  });

  it("shapes list_clients with total + trimmed fields", async () => {
    listClients.mockResolvedValue({
      items: [{ id: "c1", name: "Acme", status: "active", industry: "SaaS", extra: "dropme" }],
      total: 1,
    });
    const out = (await dispatchTool("list_clients", { status: "active" })) as {
      total: number;
      clients: Record<string, unknown>[];
    };
    expect(out.total).toBe(1);
    expect(out.clients[0]).toEqual({ id: "c1", name: "Acme", status: "active", industry: "SaaS" });
  });

  it("returns the error message when a service throws (e.g. not found)", async () => {
    getClient.mockRejectedValue(ApiError.notFound("Client not found"));
    expect(await dispatchTool("get_client", { clientId: "nope" })).toEqual({ error: "Client not found" });
  });

  it("returns an error for an unknown tool", async () => {
    expect(await dispatchTool("do_something_bad", {})).toMatchObject({ error: expect.stringContaining("unknown tool") });
  });
});
