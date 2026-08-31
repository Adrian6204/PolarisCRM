import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser, type AuthedUser } from "./auth";

/**
 * Server-component auth guards. Unlike the API `requireUser`/`requireRole`
 * (which throw HTTP errors), these redirect the browser to the sign-in page,
 * which is the right behaviour for a page render.
 */
export async function requirePageUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** True if the user may perform write actions (create/update/delete). */
export function canWrite(role: Role): boolean {
  return role === "admin" || role === "project_lead";
}
