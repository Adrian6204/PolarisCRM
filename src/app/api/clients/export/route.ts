import { getCurrentUser } from "@/lib/auth";
import { clientsForExport } from "@/features/clients/service";
import { toCsv } from "@/lib/csv";

/**
 * /api/clients/export — download all clients as CSV. Any authenticated user.
 * Returns raw text/csv (not the JSON envelope) with a download filename.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const clients = await clientsForExport();
  const csv = toCsv(
    ["name", "industry", "website", "status", "createdAt"],
    clients.map((c) => [c.name, c.industry, c.website, c.status, c.createdAt.toISOString().slice(0, 10)]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clients-${date}.csv"`,
    },
  });
}
