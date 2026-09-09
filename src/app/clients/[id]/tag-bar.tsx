"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { toast } from "@/components/ui/toaster";
import { tagChipStyle } from "@/features/tags/display";

export interface TagView {
  id: string;
  name: string;
  color: string;
}

/**
 * Client tag bar (GHL-style): removable colored chips + an inline add box that
 * suggests existing tags and creates-and-applies a new one on Enter.
 */
export function TagBar({
  clientId,
  tags,
  allTags,
}: {
  clientId: string;
  tags: TagView[];
  allTags: TagView[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    const applied = new Set(tags.map((t) => t.id));
    return allTags
      .filter((t) => !applied.has(t.id) && t.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 6);
  }, [allTags, tags, q]);
  const exactExists = allTags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());

  async function assign(body: { tagId?: string; name?: string }) {
    setBusy(true);
    try {
      await apiFetch(`/api/clients/${clientId}/tags`, { method: "POST", body: JSON.stringify(body) });
      setQ("");
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add tag.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(tagId: string) {
    try {
      await apiFetch(`/api/clients/${clientId}/tags/${tagId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to remove tag.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
          style={tagChipStyle(t.color)}
        >
          {t.name}
          <button
            onClick={() => remove(t.id)}
            className="opacity-60 hover:opacity-100"
            aria-label={`Remove tag ${t.name}`}
          >
            ✕
          </button>
        </span>
      ))}

      {adding ? (
        <div className="relative">
          <input
            autoFocus
            value={q}
            disabled={busy}
            placeholder="Tag name…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) assign({ name: q.trim() });
              if (e.key === "Escape") { setAdding(false); setQ(""); }
            }}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            className="input !w-44 !py-1 text-xs"
          />
          {(suggestions.length > 0 || (q.trim() && !exactExists)) && (
            <ul className="card absolute z-20 mt-1 w-44 overflow-hidden p-1 shadow-md">
              {suggestions.map((t) => (
                <li key={t.id}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); assign({ tagId: t.id }); }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-surface"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={tagChipStyle(t.color)} />
                    {t.name}
                  </button>
                </li>
              ))}
              {q.trim() && !exactExists && (
                <li>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); assign({ name: q.trim() }); }}
                    className="w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-surface"
                  >
                    Create “{q.trim()}”
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs text-muted hover:text-fg"
        >
          + Tag
        </button>
      )}
    </div>
  );
}
