import { requirePageUser } from "@/lib/session";
import { listApiKeys } from "@/features/api-keys/service";
import { env, mcpEnabled } from "@/lib/env";
import { ApiKeysManager } from "./api-keys-manager";

/**
 * API keys settings: personal access tokens for the MCP server. A key acts with
 * the role of the user who created it, so an agent connected with your key can
 * do exactly what you can, and no more.
 */
export const dynamic = "force-dynamic";

export default async function ApiKeysSettingsPage() {
  const user = await requirePageUser();
  const keys = await listApiKeys(user.id);
  const endpoint = (env.NEXTAUTH_URL ?? "https://your-crm.example.com").replace(/\/$/, "") + "/api/mcp";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Connect an AI agent (e.g. Claude) to Polaris CRM over MCP. A key acts as{" "}
        <span className="font-medium text-fg">you</span>: it inherits your role, and every
        change it makes is recorded in the audit log under your name.
      </p>

      <div className="card flex flex-col gap-2 p-4 text-sm">
        <h2 className="font-semibold">How access works</h2>
        <ul className="flex flex-col gap-1.5 text-muted">
          <li>
            <span className="font-medium text-fg">Logging in is a one-time step.</span> You are
            signed in right now; creating a key here is the only time a browser login is involved.
          </li>
          <li>
            <span className="font-medium text-fg">The key is the credential.</span> Agents send it
            on every request instead of signing in. There is no login screen for the MCP endpoint,
            and requests without a valid key are rejected.
          </li>
          <li>
            <span className="font-medium text-fg">A key acts as you.</span> It carries your role and
            permissions, so an agent can do exactly what you can, and no more. Its actions appear in
            the audit log under your name.
          </li>
          <li>
            <span className="font-medium text-fg">Treat it like a password.</span> Anyone holding
            the key can use it from anywhere. The secret is shown once, stored only as a hash, and
            you can set an expiry or revoke it at any time.
          </li>
        </ul>
      </div>

      {!mcpEnabled && (
        <div className="card border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          The MCP endpoint is currently <span className="font-medium">disabled</span> for this
          environment. Keys can be managed here, but agents cannot connect until{" "}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">MCP_ENABLED=true</code> is set.
        </div>
      )}

      <ApiKeysManager
        endpoint={endpoint}
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          lastUsed: k.lastUsed?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
