import type { Prisma, PrismaClient } from "@prisma/client";
import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText, optionalText } from "@/lib/validation";

/**
 * Appointment business logic (G3). Times are absolute instants. A host cannot
 * be double-booked: creating/moving an appointment that overlaps another of the
 * host's non-cancelled appointments is rejected. Optional client/contact links
 * are SetNull so deleting a client leaves the meeting history intact.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const STATUSES = Object.values(AppointmentStatus) as [AppointmentStatus, ...AppointmentStatus[]];

export const createAppointmentSchema = z
  .object({
    title: shortText(200),
    ownerId: z.string().min(1),
    clientId: z.string().min(1).nullish(),
    contactId: z.string().min(1).nullish(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    location: optionalText(200),
    notes: optionalText(2000),
    status: z.enum(STATUSES).optional(),
  })
  .refine((d) => d.endAt > d.startAt, { message: "endAt must be after startAt", path: ["endAt"] });

export const updateAppointmentSchema = z
  .object({
    title: shortText(200).optional(),
    ownerId: z.string().min(1).optional(),
    clientId: z.string().min(1).nullish(),
    contactId: z.string().min(1).nullish(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    location: optionalText(200),
    notes: optionalText(2000),
    status: z.enum(STATUSES).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" })
  .refine((d) => !(d.startAt && d.endAt) || d.endAt > d.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

const relations = {
  owner: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
} as const;

export type AppointmentWithRefs = Prisma.AppointmentGetPayload<{ include: typeof relations }>;

/** Reject if the host already has a non-cancelled appointment overlapping. */
async function assertNoOverlap(
  db: Db,
  ownerId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
) {
  const clash = await db.appointment.findFirst({
    where: {
      ownerId,
      status: { not: AppointmentStatus.cancelled },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw ApiError.conflict("The host already has an appointment in that time range");
}

export interface ListAppointmentsQuery {
  from?: Date;
  to?: Date;
  ownerId?: string;
  clientId?: string;
  status?: AppointmentStatus;
}

export async function listAppointments(
  query: ListAppointmentsQuery,
  opts: { db?: Db } = {},
): Promise<AppointmentWithRefs[]> {
  const db = opts.db ?? defaultPrisma;
  return db.appointment.findMany({
    where: {
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? { startAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) } }
        : {}),
    },
    include: relations,
    orderBy: { startAt: "asc" },
  });
}

export async function getAppointment(id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const appt = await db.appointment.findUnique({ where: { id }, include: relations });
  if (!appt) throw ApiError.notFound("Appointment not found");
  return appt;
}

export async function createAppointment(input: CreateAppointmentInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  await assertNoOverlap(db, input.ownerId, input.startAt, input.endAt);
  const appt = await db.appointment.create({
    data: {
      title: input.title,
      ownerId: input.ownerId,
      clientId: input.clientId ?? null,
      contactId: input.contactId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location ?? null,
      notes: input.notes ?? null,
      status: input.status ?? AppointmentStatus.scheduled,
    },
    include: relations,
  });
  opts.log?.debug({ appointmentId: appt.id }, "db write: appointment created");
  return appt;
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Appointment not found");

  const ownerId = input.ownerId ?? existing.ownerId;
  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt ?? existing.endAt;
  if (endAt <= startAt) throw ApiError.badRequest("endAt must be after startAt");

  // Re-check overlap only when it could have changed and the appt isn't cancelled.
  const nextStatus = input.status ?? existing.status;
  const timingChanged = input.ownerId !== undefined || input.startAt !== undefined || input.endAt !== undefined;
  if (nextStatus !== AppointmentStatus.cancelled && timingChanged) {
    await assertNoOverlap(db, ownerId, startAt, endAt, id);
  }

  const data: Prisma.AppointmentUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.ownerId !== undefined ? { owner: { connect: { id: input.ownerId } } } : {}),
    ...(input.clientId !== undefined ? { client: input.clientId ? { connect: { id: input.clientId } } : { disconnect: true } } : {}),
    ...(input.contactId !== undefined ? { contact: input.contactId ? { connect: { id: input.contactId } } : { disconnect: true } } : {}),
    ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
    ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
  const appt = await db.appointment.update({ where: { id }, data, include: relations });
  opts.log?.debug({ appointmentId: id }, "db write: appointment updated");
  return appt;
}

export async function deleteAppointment(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.appointment.deleteMany({ where: { id } });
  if (res.count === 0) throw ApiError.notFound("Appointment not found");
  opts.log?.debug({ appointmentId: id }, "db write: appointment deleted");
}
