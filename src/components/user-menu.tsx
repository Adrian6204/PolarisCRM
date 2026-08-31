"use client";

import { signIn, signOut, useSession } from "next-auth/react";

/** Shows the signed-in user + sign-out, or a sign-in link. */
export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-gray-400">…</span>;
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500">
        {session.user.email}
        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {session.user.role}
        </span>
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        Sign out
      </button>
    </div>
  );
}
