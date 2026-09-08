import { withApiRoute, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createNoteSchema, listNotes, createNote } from "@/features/notes/service";

/**
 * /api/clients/:id/notes
 *   GET  — notes on the client (any authenticated user)
 *   POST — add a note (any authed user; author taken from the session)
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async ({ params }) => {
  await requireUser();
  return ok(await listNotes(String(params.id)));
});

export const POST = withApiRoute(
  async ({ req, params, log }) => {
    const user = await requireUser();
    const input = await parseJson(req, createNoteSchema);
    const note = await createNote(String(params.id), input, user.id, { log });
    return ok(note, { status: 201 });
  },
  { rateLimit: "write" },
);
