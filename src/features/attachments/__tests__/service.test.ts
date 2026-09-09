import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Attachment units with a mocked db + mocked storage lib. Focus: path scoping
 * (a recorded path must live under the client's folder), signed-path shape,
 * and delete removing both the object and the row.
 */
const storage = vi.hoisted(() => ({
  createSignedUpload: vi.fn(async (path: string) => ({ path, token: "tok", signedUrl: `https://s/${path}?token=tok` })),
  createSignedDownload: vi.fn(async () => "https://s/download"),
  removeObject: vi.fn(async () => {}),
}));
vi.mock("@/lib/storage", () => storage);

import { signUpload, recordAttachment, deleteAttachment } from "../service";

function makeDb() {
  return {
    client: { findFirst: vi.fn().mockResolvedValue({ id: "cl1" }) },
    attachment: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  };
}

let db: ReturnType<typeof makeDb>;
beforeEach(() => {
  db = makeDb();
  vi.clearAllMocks();
  db.client.findFirst.mockResolvedValue({ id: "cl1" });
});

describe("signUpload", () => {
  it("creates a signed URL under the client's folder", async () => {
    const res = await signUpload("cl1", { name: "Report v2.PDF", size: 100, contentType: "application/pdf" }, { db: db as never });
    expect(storage.createSignedUpload).toHaveBeenCalled();
    const path = storage.createSignedUpload.mock.calls[0][0] as string;
    expect(path).toMatch(/^clients\/cl1\/[a-z0-9]+-report-v2\.pdf$/);
    expect(res.signedUrl).toContain(path);
  });
});

describe("recordAttachment", () => {
  it("rejects a path outside the client's folder", async () => {
    await expect(
      recordAttachment("cl1", { name: "x", path: "clients/OTHER/f.pdf", size: 1, contentType: "application/pdf" }, "u1", { db: db as never }),
    ).rejects.toMatchObject({ code: "bad_request" });
    expect(db.attachment.create).not.toHaveBeenCalled();
  });

  it("records metadata with the uploader", async () => {
    db.attachment.create.mockResolvedValue({ id: "a1" });
    await recordAttachment("cl1", { name: "f.pdf", path: "clients/cl1/x-f.pdf", size: 10, contentType: "application/pdf" }, "u9", { db: db as never });
    expect(db.attachment.create.mock.calls[0][0].data).toMatchObject({ clientId: "cl1", path: "clients/cl1/x-f.pdf", uploadedById: "u9" });
  });
});

describe("deleteAttachment", () => {
  it("404s when missing", async () => {
    db.attachment.findUnique.mockResolvedValue(null);
    await expect(deleteAttachment("a1", { db: db as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("removes the storage object and the row", async () => {
    db.attachment.findUnique.mockResolvedValue({ id: "a1", path: "clients/cl1/x-f.pdf" });
    db.attachment.delete.mockResolvedValue({ id: "a1" });
    await deleteAttachment("a1", { db: db as never });
    expect(storage.removeObject).toHaveBeenCalledWith("clients/cl1/x-f.pdf");
    expect(db.attachment.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });
});
