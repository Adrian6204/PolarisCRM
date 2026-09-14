import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";

// Importing the route pulls in the whole services graph + MCP SDK; the first
// cold transform can take ~20s, so give module loads and their tests headroom.
const LOAD_TIMEOUT = 60_000;

/**
 * In-process integration test for the MCP endpoint. Drives the actual route
 * handler with web-standard Requests, no DB and no network, to verify the
 * pieces unit tests can't: the transport responds without Redis (stateless),
 * the MCP_ENABLED gate, bearer-auth rejection, and that the full tool set
 * registers and is listable after a handshake.
 *
 * The API-key resolver is mocked so we can exercise the authenticated path
 * without an api_keys table.
 */
const resolveApiKey = vi.fn();
vi.mock("@/lib/mcp/auth", () => ({
  resolveApiKey: (...a: unknown[]) => resolveApiKey(...a),
  bearerFromHeader: () => null,
}));

const ENDPOINT = "http://localhost/api/mcp";
const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
const initBody = (id: number) => ({
  jsonrpc: "2.0",
  id,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "qa", version: "1" } },
});

/** Parse a response body that may be JSON or an SSE `data:` frame. */
async function readJsonRpc(res: Response): Promise<unknown> {
  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    return line ? JSON.parse(line.slice(5).trim()) : null;
  }
  return text ? JSON.parse(text) : null;
}

async function loadHandler(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv("MCP_ENABLED", enabled ? "true" : "false");
  return import("../route");
}

beforeEach(() => {
  resolveApiKey.mockReset();
  resolveApiKey.mockResolvedValue({ id: "u1", email: "a@b.co", role: "admin", keyId: "k1" });
});

describe("MCP_ENABLED gate", () => {
  afterEach(() => vi.unstubAllEnvs());
  it(
    "returns 404 when disabled",
    async () => {
      const { POST } = await loadHandler(false);
      const res = await POST(new Request(ENDPOINT, { method: "POST", headers: MCP_HEADERS, body: JSON.stringify(initBody(1)) }));
      expect(res.status).toBe(404);
    },
    LOAD_TIMEOUT,
  );
});

// The rest share one enabled handler load to avoid paying the re-import cost.
describe("enabled endpoint", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeAll(async () => {
    ({ POST } = await loadHandler(true));
  }, LOAD_TIMEOUT);
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a request with no Authorization header (401)", async () => {
    const res = await POST(new Request(ENDPOINT, { method: "POST", headers: MCP_HEADERS, body: JSON.stringify(initBody(1)) }));
    expect(res.status).toBe(401);
    expect(resolveApiKey).not.toHaveBeenCalled();
  });

  it("rejects when the key resolver throws (401)", async () => {
    resolveApiKey.mockRejectedValue(new Error("bad key"));
    const res = await POST(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { ...MCP_HEADERS, authorization: "Bearer pcrm_bogus" },
        body: JSON.stringify(initBody(1)),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("completes an initialize handshake without Redis (stateless transport works)", async () => {
    const res = await POST(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { ...MCP_HEADERS, authorization: "Bearer pcrm_valid" },
        body: JSON.stringify(initBody(1)),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await readJsonRpc(res)) as { result?: { serverInfo?: unknown; capabilities?: unknown } };
    expect(body?.result?.capabilities).toBeDefined();
  });

  it("lists the full tool set after initialize (same session id)", async () => {
    const auth = { ...MCP_HEADERS, authorization: "Bearer pcrm_valid" };

    const initRes = await POST(new Request(ENDPOINT, { method: "POST", headers: auth, body: JSON.stringify(initBody(1)) }));
    const sessionId = initRes.headers.get("mcp-session-id");
    await initRes.text();

    // The MCP spec requires an `initialized` notification before other calls.
    const withSession = sessionId ? { ...auth, "mcp-session-id": sessionId } : auth;
    await POST(
      new Request(ENDPOINT, {
        method: "POST",
        headers: withSession,
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }),
    ).then((r) => r.text());

    const listRes = await POST(
      new Request(ENDPOINT, {
        method: "POST",
        headers: withSession,
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      }),
    );
    const body = (await readJsonRpc(listRes)) as { result?: { tools?: { name: string }[] } };
    const names = (body?.result?.tools ?? []).map((t) => t.name);

    // Spot-check representative reads, writes, and a destructive tool are present.
    expect(names).toEqual(
      expect.arrayContaining(["search_crm", "list_clients", "log_activity", "create_deal", "delete_client"]),
    );
    expect(names.length).toBeGreaterThanOrEqual(20);
  });
});
