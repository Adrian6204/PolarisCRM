"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

/** Soft-deletes a client after a confirm, then returns to the list. */
export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete "${clientName}"? It can be restored by an admin.`)) return;
    setPending(true);
    try {
      await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
      router.push("/clients");
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Failed to delete.");
      setPending(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={pending}
      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
