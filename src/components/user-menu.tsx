"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { IconLogout } from "./icons";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  project_lead: "Project lead",
  team_member: "Team member",
};

/** Signed-in identity + sign-out, or a sign-in affordance. */
export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-muted">…</span>;
  }

  if (!session?.user) {
    return (
      <button onClick={() => signIn()} className="btn btn-secondary">
        Sign in
      </button>
    );
  }

  const name = session.user.name ?? session.user.email ?? "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2.5 sm:flex">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
            color: "var(--primary)",
          }}
          aria-hidden
        >
          {initials || "?"}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium">{session.user.email}</div>
          <div className="text-xs text-muted">
            {ROLE_LABEL[session.user.role] ?? session.user.role}
          </div>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn btn-ghost !p-2"
        aria-label="Sign out"
        title="Sign out"
      >
        <IconLogout className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
