import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { env } from "./env";
import { ApiError } from "./errors";
import type { Role } from "@prisma/client";

/**
 * NextAuth (Auth.js) configuration with role-based sessions.
 *
 * Uses a JWT session strategy (no DB session table needed) which suits
 * serverless well. The user's role is embedded in the token and surfaced on
 * the session so route handlers can authorize without an extra DB round-trip.
 *
 * NOTE: the credentials provider here uses a SHA-256 comparison as a
 * placeholder for local/seed accounts. Before real use, swap to a slow hash
 * (argon2/bcrypt) — tracked for the Phase 9 hardening pass.
 */
function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/** Constant-time compare of a plaintext password against a stored hash. */
export function verifyPassword(password: string, storedHash: string): boolean {
  const a = Buffer.from(hash(password));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Produce the hash to persist for a new/seed credential account. */
export function hashPassword(password: string): string {
  return hash(password);
}

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        if (!verifyPassword(credentials.password, user.passwordHash)) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * Read the current authenticated user from the session, or null.
 * Route handlers should prefer `requireUser` / `requireRole`.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

/** Throw 401 if not authenticated. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthorized();
  return user;
}

/** Throw 401 if unauthenticated, 403 if the role isn't in `allowed`. */
export async function requireRole(...allowed: Role[]): Promise<AuthedUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw ApiError.forbidden();
  return user;
}
