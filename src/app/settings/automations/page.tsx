import { requirePageUser } from "@/lib/session";
import { listAutomations, listRecentRuns } from "@/features/automations/service";
import { AutomationsManager } from "./automations-manager";

/**
 * Automation settings: trigger → conditions → actions rules, plus a recent-run
 * log. Admins manage rules; everyone else sees them read-only.
 */
export const dynamic = "force-dynamic";

export default async function AutomationsSettingsPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const [automations, runs] = await Promise.all([listAutomations(), listRecentRuns(20)]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        When something happens in the CRM, run actions automatically.
        {!isAdmin && " Only admins can change these."}
      </p>
      <AutomationsManager
        isAdmin={isAdmin}
        initial={automations.map((a) => ({
          id: a.id,
          name: a.name,
          trigger: a.trigger,
          active: a.active,
          conditions: (a.conditions as Record<string, string> | null) ?? null,
          actions: a.actions.map((ac) => ({ type: ac.type, config: ac.config as Record<string, unknown> })),
        }))}
        runs={runs.map((r) => ({
          id: r.id,
          name: r.automation.name,
          status: r.status,
          detail: r.detail,
          at: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
