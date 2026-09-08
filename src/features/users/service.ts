import type { Prisma, PrismaClient } from "@prisma/client";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/auth";

/**
 * Team / user administration (G5). Admins provision accounts, assign roles,
 * reset passwords, and deactivate people (login is revoked but their history
 * stays intact). Guardrails prevent locking the org out of admin access or a
 * user changing their own role/status.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const ROLES = Object.values(Role) as [Role, ...Role[]];

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(ROLES).default(Role.team_member),
  password: z.string().min(8, "password must be at least 8 characters").max(200),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const setPasswordSchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters").max(200),
  // Required when a user changes their own password; ignored for admin resets.
  currentPassword: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.user.findMany({ select: publicSelect, orderBy: [{ active: "desc" }, { name: "asc" }] });
}

export async function createUser(input: CreateUserInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw ApiError.conflict("A user with that email already exists");
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
    select: publicSelect,
  });
  opts.log?.debug({ userId: user.id }, "db write: user created");
  return user;
}

/** Count of accounts that can currently sign in as admin. */
async function activeAdminCount(db: Db) {
  return db.user.count({ where: { role: Role.admin, active: true } });
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorId: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  if (!target) throw ApiError.notFound("User not found");

  // A user can't change their own role or deactivate themselves (lock-out guard).
  if (actorId === id && (input.role !== undefined || input.active === false)) {
    throw ApiError.badRequest("You can't change your own role or active status");
  }

  // Keep at least one active admin: block demoting/deactivating the last one.
  const removesAdminAccess =
    target.role === Role.admin &&
    target.active &&
    ((input.role !== undefined && input.role !== Role.admin) || input.active === false);
  if (removesAdminAccess && (await activeAdminCount(db)) <= 1) {
    throw ApiError.conflict("There must be at least one active admin");
  }

  const user = await db.user.update({ where: { id }, data: input, select: publicSelect });
  opts.log?.debug({ userId: id }, "db write: user updated");
  return user;
}

/** Admin reset of any user's password (no current-password check). */
export async function adminSetPassword(id: string, newPassword: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.user.updateMany({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
  if (res.count === 0) throw ApiError.notFound("User not found");
  opts.log?.debug({ userId: id }, "db write: password reset (admin)");
}

/** A user changing their own password — verifies the current one first. */
export async function changeOwnPassword(
  id: string,
  currentPassword: string | undefined,
  newPassword: string,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const user = await db.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (!user.passwordHash || !currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest("Current password is incorrect");
  }
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
  opts.log?.debug({ userId: id }, "db write: password changed (self)");
}
