import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser, canWrite } from "@/lib/session";
import { getDeal } from "@/features/deals/service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { DealEditor } from "./deal-editor";

/** Deal detail / editor (Phase 8). */
export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const deal = await getDeal(id).catch((err) => {
    if (err instanceof ApiError && err.code === "not_found") notFound();
    throw err;
  });
  const members = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/pipeline" className="text-sm text-muted hover:underline">
          ← Pipeline
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
        <p className="text-sm text-muted">
          <Link href={`/clients/${deal.clientId}`} className="link hover:underline">
            {deal.client.name}
          </Link>
        </p>
      </div>

      <DealEditor
        writable={canWrite(user.role)}
        members={members}
        deal={{
          id: deal.id,
          title: deal.title,
          value: deal.value,
          stage: deal.stage,
          ownerId: deal.ownerId,
          notes: deal.notes ?? "",
          expectedCloseDate: dateInput(deal.expectedCloseDate),
        }}
      />
    </div>
  );
}
