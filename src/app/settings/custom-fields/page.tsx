import { requirePageUser } from "@/lib/session";
import { listFieldDefs } from "@/features/custom-fields/service";
import { FieldsManager } from "./fields-manager";

/**
 * Custom-field settings. Definitions are the org-wide schema of extra client
 * attributes. Admins manage them here; everyone else sees a read-only list.
 */
export const dynamic = "force-dynamic";

export default async function CustomFieldsSettingsPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const defs = await listFieldDefs({ includeArchived: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom fields</h1>
        <p className="text-sm text-muted">
          Extra attributes captured on every client record.
          {!isAdmin && " Only admins can change these."}
        </p>
      </div>

      <FieldsManager
        isAdmin={isAdmin}
        initialDefs={defs.map((d) => ({
          id: d.id,
          key: d.key,
          label: d.label,
          type: d.type,
          options: d.options,
          sortOrder: d.sortOrder,
          archived: d.archived,
        }))}
      />
    </div>
  );
}
