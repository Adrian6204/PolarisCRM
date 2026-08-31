import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Augment NextAuth's session/JWT types so the role we thread through the
 * callbacks in src/lib/auth.ts is type-safe at every call site.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
  }
}
