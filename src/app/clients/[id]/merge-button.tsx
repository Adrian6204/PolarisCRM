"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SimpleSelect } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm";
import { toast } from "@/components/ui/toaster";

interface Candidate { id: string; name: string; industry: string | null; sameName: boolean }

/**
 * Merge-clients control (admin, on the survivor's detail page): pick a duplicate
 * to absorb — same-name matches are surfaced first — then confirm. The source
 * is retired and all its records move to this client.
 */
export function MergeButton({
  targetId,
  targetName,
  candidates,
}: {
  targetId: string;
  targetName: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);

  const source = candidates.find((c) => c.id === sourceId);

  async function merge() {
    if (!source) return;
    setOpen(false);
    const ok = await confirm({
      title: `Merge "${source.name}" into "${targetName}"?`,
      description: "All of its contacts, projects, deals, activities, notes, tags and appointments move here, and the duplicate is removed. This can't be undone.",
      confirmLabel: "Merge",
      destructive: true,
    });
    if (!ok) { setOpen(true); return; }
    setBusy(true);
    try {
      await apiFetch(`/api/clients/${targetId}/merge`, { method: "POST", body: JSON.stringify({ sourceId }) });
      toast.success(`Merged "${source.name}" into "${targetName}".`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Merge failed.");
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) return null;

  // Same-name matches first, each flagged, so likely duplicates are obvious.
  const options = [...candidates]
    .sort((a, b) => Number(b.sameName) - Number(a.sameName) || a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.sameName ? `${c.name} — likely duplicate` : c.name }));

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy} className="btn btn-secondary !py-1.5">
        Merge
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Merge a duplicate into {targetName}</DialogTitle>
          <DialogDescription>
            Choose the client to absorb. Its records move here and it&rsquo;s retired.
          </DialogDescription>
          <SimpleSelect
            value={sourceId}
            onValueChange={setSourceId}
            aria-label="Client to merge"
            placeholder="Select a client…"
            options={options}
          />
          <div className="flex items-center gap-2">
            <button onClick={merge} disabled={!sourceId} className="btn btn-primary !py-1.5">Merge</button>
            <button onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
