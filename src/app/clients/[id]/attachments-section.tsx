"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { useConfirm } from "@/components/confirm";
import { toast } from "@/components/ui/toaster";

export interface AttachmentVM {
  id: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
  uploadedBy: { name: string | null; email: string } | null;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Client attachments: upload straight to Supabase Storage via a signed URL
 * (bytes never pass through our server), then record metadata. Lists files
 * with size/uploader, a download link, and delete. Hidden when storage is off.
 */
export function AttachmentsSection({
  clientId,
  attachments,
  writable,
  storageEnabled,
}: {
  clientId: string;
  attachments: AttachmentVM[];
  writable: boolean;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File) {
    setBusy(true);
    try {
      const contentType = file.type || "application/octet-stream";
      // 1) Ask our API for a signed upload URL scoped to this client.
      const signed = await apiFetch<{ path: string; signedUrl: string }>(
        `/api/clients/${clientId}/attachments/sign`,
        { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType }) },
      );
      // 2) Upload the bytes straight to Storage (token is in the signed URL).
      const put = await fetch(signed.signedUrl, { method: "PUT", headers: { "content-type": contentType }, body: file });
      if (!put.ok) throw new Error("Upload to storage failed");
      // 3) Record the metadata.
      await apiFetch(`/api/clients/${clientId}/attachments`, {
        method: "POST",
        body: JSON.stringify({ name: file.name, path: signed.path, size: file.size, contentType }),
      });
      toast.success(`Uploaded ${file.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(a: AttachmentVM) {
    if (!(await confirm({ title: `Delete ${a.name}?`, confirmLabel: "Delete", destructive: true }))) return;
    try {
      await apiFetch(`/api/attachments/${a.id}`, { method: "DELETE" });
      toast.success("Deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Delete failed.");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files</h2>
        {writable && storageEnabled && (
          <>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="text-sm link hover:underline">
              {busy ? "Uploading…" : "+ Upload file"}
            </button>
          </>
        )}
      </div>

      {!storageEnabled ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          File storage isn&rsquo;t configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable uploads.
        </p>
      ) : attachments.length === 0 ? (
        <p className="rounded border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No files yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {a.name}
                </a>
                <span className="text-sm text-muted">
                  {humanSize(a.size)}
                  {a.uploadedBy ? ` · ${a.uploadedBy.name ?? a.uploadedBy.email}` : ""} · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              {writable && (
                <button onClick={() => remove(a)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
