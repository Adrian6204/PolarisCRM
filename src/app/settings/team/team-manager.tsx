"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Role } from "@prisma/client";
import { apiFetch, ApiClientError } from "@/lib/api-client";

interface UserV { id: string; name: string | null; email: string; role: Role; active: boolean }

const ROLES = Object.values(Role);
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  project_lead: "Project lead",
  team_member: "Team member",
};

export function TeamManager({ isAdmin, meId, users }: { isAdmin: boolean; meId: string; users: UserV[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed.");
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && <CreateUserForm onCreate={(body) => run(() => apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) }))} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              {isAdmin && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} isAdmin={isAdmin} isMe={u.id === meId} run={run} />
            ))}
          </tbody>
        </table>
      </div>

      <ChangeOwnPassword meId={meId} run={run} />
    </div>
  );
}

function UserRow({
  user,
  isAdmin,
  isMe,
  run,
}: {
  user: UserV;
  isAdmin: boolean;
  isMe: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const [pw, setPw] = useState("");

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{user.name ?? "—"}{isMe && <span className="ml-1 text-xs text-muted">(you)</span>}</span>
          <span className="text-xs text-muted">{user.email}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {isAdmin && !isMe ? (
          <select
            value={user.role}
            onChange={(e) => run(() => apiFetch(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) })).catch(() => {})}
            className="input !w-auto !py-1 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        ) : (
          <span>{ROLE_LABELS[user.role]}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-surface2 text-muted"}`}>
          {user.active ? "Active" : "Deactivated"}
        </span>
      </td>
      {isAdmin && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3 text-sm">
            {!isMe && (
              <button
                onClick={() => run(() => apiFetch(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) })).catch(() => {})}
                className="text-muted hover:text-fg"
              >
                {user.active ? "Deactivate" : "Activate"}
              </button>
            )}
            <button onClick={() => setResetting((v) => !v)} className="link hover:underline">
              {resetting ? "Cancel" : "Reset password"}
            </button>
          </div>
          {resetting && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 8)" className="input !w-56 !py-1 text-sm" />
              <button
                onClick={() =>
                  run(() => apiFetch(`/api/users/${user.id}/password`, { method: "PATCH", body: JSON.stringify({ password: pw }) }))
                    .then(() => { setResetting(false); setPw(""); })
                    .catch(() => {})
                }
                disabled={pw.length < 8}
                className="btn btn-primary !py-1"
              >
                Set
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function CreateUserForm({ onCreate }: { onCreate: (body: unknown) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.team_member);
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({ name: name.trim(), email: email.trim(), role, password })
      .then(() => { setName(""); setEmail(""); setPassword(""); setRole(Role.team_member); })
      .catch(() => {});
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold">Add a team member</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="input" required />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Initial password (min 8)" className="input" required minLength={8} />
      </div>
      <div>
        <button type="submit" disabled={!name.trim() || !email.trim() || password.length < 8} className="btn btn-primary !py-1.5">
          Create account
        </button>
      </div>
    </form>
  );
}

function ChangeOwnPassword({ meId, run }: { meId: string; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold">Your password</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => apiFetch(`/api/users/${meId}/password`, { method: "PATCH", body: JSON.stringify({ currentPassword: current, password: next }) }))
            .then(() => { setCurrent(""); setNext(""); setDone(true); })
            .catch(() => setDone(false));
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Current password
          <input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setDone(false); }} className="input !w-48" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          New password
          <input type="password" value={next} onChange={(e) => { setNext(e.target.value); setDone(false); }} className="input !w-48" required minLength={8} />
        </label>
        <button type="submit" disabled={!current || next.length < 8} className="btn btn-secondary !py-1.5">Change</button>
        {done && <span className="text-sm text-muted">Updated ✓</span>}
      </form>
    </div>
  );
}
