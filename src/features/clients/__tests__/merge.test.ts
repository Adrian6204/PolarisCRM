import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeClients } from "../merge";

/**
 * Client-merge units with a mocked tx. Focus: self-merge + missing-record
 * guards, FK repointing of 1:N relations, and composite-join de-duplication
 * (shared tag/field → source row dropped, unique → moved) + source retirement.
 */
function makeTx() {
  const tx = {
    client: { findFirst: vi.fn(), update: vi.fn() },
    contact: { updateMany: vi.fn() },
    project: { updateMany: vi.fn() },
    activity: { updateMany: vi.fn() },
    deal: { updateMany: vi.fn() },
    note: { updateMany: vi.fn() },
    appointment: { updateMany: vi.fn() },
    auditLog: { updateMany: vi.fn(), create: vi.fn() },
    clientTag: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), delete: vi.fn() },
    clientCustomField: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), delete: vi.fn() },
  };
  return tx;
}

let tx: ReturnType<typeof makeTx>;
beforeEach(() => {
  tx = makeTx();
  tx.client.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === "src" ? { id: "src", name: "Dupe" } : where.id === "tgt" ? { id: "tgt", name: "Keep" } : null,
  );
});

describe("mergeClients", () => {
  it("rejects merging a client into itself", async () => {
    await expect(mergeClients("a", "a", { db: tx as never })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("404s when the source is missing", async () => {
    await expect(mergeClients("missing", "tgt", { db: tx as never })).rejects.toMatchObject({ code: "not_found" });
  });

  it("repoints 1:N relations and retires the source", async () => {
    await mergeClients("src", "tgt", { db: tx as never });
    for (const m of [tx.contact, tx.project, tx.activity, tx.deal, tx.note, tx.appointment]) {
      expect(m.updateMany).toHaveBeenCalledWith({ where: { clientId: "src" }, data: { clientId: "tgt" } });
    }
    expect(tx.client.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "src" } }));
    expect(tx.client.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("moves unique tags but drops ones the target already has", async () => {
    tx.clientTag.findMany
      .mockResolvedValueOnce([{ tagId: "shared" }, { tagId: "unique" }]) // source
      .mockResolvedValueOnce([{ tagId: "shared" }]); // target
    await mergeClients("src", "tgt", { db: tx as never });
    expect(tx.clientTag.delete).toHaveBeenCalledWith({ where: { clientId_tagId: { clientId: "src", tagId: "shared" } } });
    expect(tx.clientTag.update).toHaveBeenCalledWith({ where: { clientId_tagId: { clientId: "src", tagId: "unique" } }, data: { clientId: "tgt" } });
  });

  it("writes an audit entry when an actor is provided", async () => {
    await mergeClients("src", "tgt", { db: tx as never, actorId: "admin" });
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
