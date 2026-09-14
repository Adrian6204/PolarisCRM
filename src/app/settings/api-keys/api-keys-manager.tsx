"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

interface KeyV {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Expiry choices offered in the create form (value = days; 0 = never).
const EXPIRY_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Never" },
];

interface CreatedKey {
  summary: { id: string };
  raw: string;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-";

export function ApiKeysManager({ endpoint, keys }: { endpoint: string; keys: KeyV[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The raw secret is returned exactly once, on creation, held in memory only.
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await apiFetch<CreatedKey>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          // 0 = never; omit the field so the schema treats it as non-expiring.
          ...(expiresInDays > 0 ? { expiresInDays } : {}),
        }),
      });
      setFreshKey(created.raw);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create key.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not revoke key.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="card flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold">Create an API key</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Label
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Claude Desktop for my laptop"
              className="input"
              required
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Expires
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="input !w-32"
              aria-label="Expires"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!name.trim() || creating} className="btn btn-primary !py-1.5">
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {freshKey && (
        <div className="card flex flex-col gap-2 border-green-300 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/40">
          <h2 className="text-sm font-semibold text-green-900 dark:text-green-200">
            Copy your key now, it won’t be shown again
          </h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/10 px-2 py-1.5 font-mono text-xs dark:bg-white/10">
              {freshKey}
            </code>
            <button
              type="button"
              className="btn btn-secondary !py-1"
              onClick={() => {
                navigator.clipboard?.writeText(freshKey).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button type="button" className="text-sm text-muted hover:text-fg" onClick={() => setFreshKey(null)}>
              Done
            </button>
          </div>
          <p className="text-xs text-green-900/80 dark:text-green-200/80">
            Point your MCP client at <code className="font-mono">{endpoint}</code> and send this
            key as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Label</th>
              <th className="px-4 py-2.5 font-semibold">Key</th>
              <th className="px-4 py-2.5 font-semibold">Created</th>
              <th className="px-4 py-2.5 font-semibold">Last used</th>
              <th className="px-4 py-2.5 font-semibold">Expires</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                  No API keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => {
              const revoked = Boolean(k.revokedAt);
              const expired = !revoked && Boolean(k.expiresAt) && new Date(k.expiresAt!) <= new Date();
              const status = revoked ? "Revoked" : expired ? "Expired" : "Active";
              const active = !revoked && !expired;
              return (
                <tr key={k.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{k.prefix}…</td>
                  <td className="px-4 py-3 text-muted">{fmt(k.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{fmt(k.lastUsed)}</td>
                  <td className="px-4 py-3 text-muted">{k.expiresAt ? fmt(k.expiresAt) : "Never"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        active
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-surface2 text-muted"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!revoked && (
                      <button onClick={() => revoke(k.id)} className="text-sm text-red-600 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
