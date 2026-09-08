import { requirePageUser } from "@/lib/session";
import { listUsers } from "@/features/users/service";
import { TeamManager } from "./team-manager";

/**
 * Team settings: admins provision accounts, assign roles, reset passwords, and
 * activate/deactivate people. Everyone can change their own password here.
 */
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const user = await requirePageUser();
  const isAdmin = user.role === "admin";
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {isAdmin
          ? "Provision accounts, assign roles, and deactivate people. Deactivated users keep their history but can't sign in."
          : "Your team. Only admins can add or change accounts."}
      </p>
      <TeamManager
        isAdmin={isAdmin}
        meId={user.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        }))}
      />
    </div>
  );
}
