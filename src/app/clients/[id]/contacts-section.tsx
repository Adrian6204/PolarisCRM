"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

type ContactRole = "decision_maker" | "technical_poc" | "billing" | "other";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: ContactRole;
  isPrimary: boolean;
}

const ROLES: ContactRole[] = ["decision_maker", "technical_poc", "billing", "other"];
const ROLE_LABELS: Record<ContactRole, string> = {
  decision_maker: "Decision maker",
  technical_poc: "Technical POC",
  billing: "Billing",
  other: "Other",
};

/**
 * Contacts manager for a client. Add / remove / set-primary hit the nested
 * contact API; the server enforces the single-primary invariant, so after each
 * mutation we refresh the server component to reflect the canonical state.
 */
export function ContactsSection({
  clientId,
  contacts,
  writable,
}: {
  clientId: string;
  contacts: Contact[];
  writable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed.");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {writable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm link hover:underline"
          >
            + Add contact
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {contacts.length === 0 && !adding ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No contacts yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="flex items-center gap-2 font-medium">
                  {c.name}
                  {c.isPrimary && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Primary
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted">
                  {ROLE_LABELS[c.role]} · {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </span>
              </div>
              {writable && (
                <div className="flex items-center gap-3 text-sm">
                  {!c.isPrimary && (
                    <button
                      onClick={() =>
                        run(() =>
                          apiFetch(`/api/clients/${clientId}/contacts/${c.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ isPrimary: true }),
                          }),
                        )
                      }
                      className="text-muted hover:text-fg"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!confirm(`Remove ${c.name}?`)) return;
                      run(() =>
                        apiFetch(`/api/clients/${clientId}/contacts/${c.id}`, {
                          method: "DELETE",
                        }),
                      );
                    }}
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddContactForm
          onCancel={() => setAdding(false)}
          onSubmit={(values) =>
            run(async () => {
              await apiFetch(`/api/clients/${clientId}/contacts`, {
                method: "POST",
                body: JSON.stringify(values),
              });
              setAdding(false);
            })
          }
        />
      )}
    </section>
  );
}

function AddContactForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    email: string;
    phone: string;
    role: ContactRole;
    isPrimary: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<ContactRole>("other");
  const [isPrimary, setIsPrimary] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, email, phone, role, isPrimary });
      }}
      className="flex flex-col gap-3 rounded border border-line p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ContactRole)}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
        />
        Primary contact
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn btn-primary !py-1.5"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "input";
