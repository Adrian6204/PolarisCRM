import { requirePageUser } from "@/lib/session";
import { listPipelines } from "@/features/pipelines/service";
import { PipelinesManager } from "./pipelines-manager";

/**
 * Pipeline settings. Admins create pipelines, edit their stages (name, kind,
 * order), set the default, and archive/delete. Everyone else sees it read-only.
 */
export const dynamic = "force-dynamic";

export default async function PipelinesSettingsPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const pipelines = await listPipelines({ includeArchived: true });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Named sales funnels and their stages. Deals move through the stages of
        their pipeline.{!isAdmin && " Only admins can change these."}
      </p>
      <PipelinesManager
        isAdmin={isAdmin}
        initial={pipelines.map((p) => ({
          id: p.id,
          name: p.name,
          archived: p.archived,
          isDefault: p.isDefault,
          stages: p.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
        }))}
      />
    </div>
  );
}
