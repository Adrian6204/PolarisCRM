"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import type { ImportResult } from "@/features/clients/service";

/**
 * Clients CSV toolbar: an Export link (downloads all clients) and an Import
 * dialog (admins/leads) that accepts pasted CSV or a file, posts it, and shows
 * a per-row result summary.
 */
export function ClientIO({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File) {
    setCsv(await file.text());
  }

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch<ImportResult>("/api/clients/import", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setResult(res);
      toast.success(`Imported ${res.created} client${res.created === 1 ? "" : "s"}${res.skipped ? `, skipped ${res.skipped}` : ""}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Download endpoint (not a page) — a real anchor with `download` is correct here. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/clients/export" download className="btn btn-secondary !py-1.5">Export CSV</a>
      {canImport && (
        <>
          <button onClick={() => { setOpen(true); setResult(null); setCsv(""); }} className="btn btn-secondary !py-1.5">
            Import CSV
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Import clients</DialogTitle>
              <DialogDescription>
                Paste CSV or choose a file. Expected columns: <code>name</code>, <code>industry</code>,
                {" "}<code>website</code>, <code>status</code>. Existing names are skipped.
              </DialogDescription>

              <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
              <textarea
                rows={8}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={"name,industry,website,status\nAcme Inc,SaaS,https://acme.com,prospect"}
                className="input font-mono-nums text-xs"
              />

              {result && (
                <div className="rounded-md border border-line p-3 text-sm">
                  <p><span className="font-medium">{result.created}</span> created · <span className="font-medium">{result.skipped}</span> skipped · <span className="font-medium">{result.errors.length}</span> errors</p>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                      {result.errors.map((e) => (
                        <li key={e.row}>Row {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={submit} disabled={busy || !csv.trim()} className="btn btn-primary !py-1.5">
                  {busy ? "Importing…" : "Import"}
                </button>
                <button onClick={() => setOpen(false)} className="btn btn-ghost">Close</button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
