import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { env } from "./env";
import { ApiError } from "./errors";
import { enforceRateLimit } from "./ratelimit";
import { logger } from "./logger";
import type { Role } from "@prisma/client";

/**
 * NextAuth (Auth.js) configuration with role-based sessions.
 *
 * Uses a JWT session strategy (no DB session table needed) which suits
 * serverless well. The user's role is embedded in the token and surfaced on
 * the session so route handlers can authorize without an extra DB round-trip.
 *
 * Passwords are hashed with bcrypt (a deliberately slow hash). bcryptjs is
 * pure-JS so it runs on serverless without native build steps.
 */
const BCRYPT_COST = 10;

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    // Malformed/legacy hash — never throw, just deny.
    return false;
  }
}

/** Produce the bcrypt hash to persist for a new/seed credential account. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase();

        // Brute-force protection: strict `auth`-tier limit keyed by email + IP.
        const ip =
          (req?.headers?.["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ?? "unknown";
        const rl = await enforceRateLimit("auth", `login:${email}:${ip}`);
        if (!rl.success) {
          logger.warn({ email, ip }, "login rate limit exceeded");
          // NextAuth surfaces this as a generic sign-in failure.
          throw new Error("Too many attempts. Please try again shortly.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(credentials.password, user.passwordHash))) return null;
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
