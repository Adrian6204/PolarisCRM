import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * Root — send authenticated users to the clients workspace, everyone else to
 * sign in. (A proper dashboard lands in Phase 6.)
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/clients" : "/login");
}
