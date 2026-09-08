import type { Prisma, PrismaClient } from "@prisma/client";
import { CustomFieldType } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText } from "@/lib/validation";
import { runInTx } from "@/lib/tx";

/**
 * Custom fields (GHL-style): an admin-managed schema of extra client
 * attributes plus each client's values. Values are stored as text and
 * validated/coerced against the definition's type on write; the UI reads them
 * back typed via `coerceValue`-normalised strings.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const FIELD_TYPES = Object.values(CustomFieldType) as [CustomFieldType, ...CustomFieldType[]];

export const createFieldDefSchema = z
  .object({
    label: shortText(60),
    type: z.enum(FIELD_TYPES).default(CustomFieldType.text),
    options: z.array(shortText(60)).max(50).default([]),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((d) => d.type !== CustomFieldType.select || d.options.length > 0, {
    message: "select fields need at least one option",
    path: ["options"],
  });

export const updateFieldDefSchema = z.object({
  label: shortText(60).optional(),
  options: z.array(shortText(60)).max(50).optional(),
  sortOrder: z.coerce.number().int().optional(),
  archived: z.boolean().optional(),
});

// Bulk set of a client's values. An empty string clears (deletes) the value.
export const setValuesSchema = z.object({
  values: z
    .array(z.object({ fieldId: z.string().min(1), value: z.string().max(2000) }))
    .max(100),
});

export type CreateFieldDefInput = z.infer<typeof createFieldDefSchema>;
export type UpdateFieldDefInput = z.infer<typeof updateFieldDefSchema>;
export type SetValuesInput = z.infer<typeof setValuesSchema>;

/** Slugify a label into a stable machine key. */
function slugify(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "field";
}

/**
 * Validate + normalise a raw value against a field type. Returns the canonical
 * string to persist, or throws bad_request. Empty input is caller's concern.
 */
export function coerceValue(
  type: CustomFieldType,
  raw: string,
  options: string[] = [],
): string {
  const v = raw.trim();
  switch (type) {
    case CustomFieldType.number: {
      if (!/^-?\d+(\.\d+)?$/.test(v)) throw ApiError.badRequest("Value must be a number");
      return v;
    }
    case CustomFieldType.date: {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw ApiError.badRequest("Value must be a valid date");
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    case CustomFieldType.boolean: {
      if (v !== "true" && v !== "false") throw ApiError.badRequest("Value must be true or false");
      return v;
    }
    case CustomFieldType.url: {
      try {
        // eslint-disable-next-line no-new
        new URL(v);
      } catch {
        throw ApiError.badRequest("Value must be a valid URL");
      }
      return v;
    }
    case CustomFieldType.select: {
      if (!options.includes(v)) throw ApiError.badRequest("Value must be one of the field's options");
      return v;
    }
    default:
      return v; // text / textarea
  }
}

// --- Definitions ----------------------------------------------------------

export async function listFieldDefs(
  opts: { db?: Db; includeArchived?: boolean } = {},
) {
  const db = opts.db ?? defaultPrisma;
  return db.customFieldDef.findMany({
    where: opts.includeArchived ? {} : { archived: false },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function createFieldDef(input: CreateFieldDefInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  // Derive a unique key from the label.
  const base = slugify(input.label);
  let key = base;
  for (let i = 2; await db.customFieldDef.findUnique({ where: { key } }); i++) {
    key = `${base}_${i}`;
  }
  const def = await db.customFieldDef.create({
    data: {
      key,
      label: input.label,
      type: input.type,
      options: input.type === CustomFieldType.select ? input.options : [],
      sortOrder: input.sortOrder,
    },
  });
  opts.log?.debug({ fieldId: def.id }, "db write: custom field def created");
  return def;
}

export async function updateFieldDef(id: string, input: UpdateFieldDefInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.customFieldDef.updateMany({ where: { id }, data: input });
  if (res.count === 0) throw ApiError.notFound("Custom field not found");
  opts.log?.debug({ fieldId: id }, "db write: custom field def updated");
  return db.customFieldDef.findUnique({ where: { id } });
}

/** Hard-delete a definition (and its values, via cascade). */
export async function deleteFieldDef(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.customFieldDef.deleteMany({ where: { id } });
  if (res.count === 0) throw ApiError.notFound("Custom field not found");
  opts.log?.debug({ fieldId: id }, "db write: custom field def deleted");
}

// --- Per-client values ----------------------------------------------------

export interface ClientFieldView {
  fieldId: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  value: string | null;
}

/** All active definitions joined with this client's values (null if unset). */
export async function getClientCustomFields(
  clientId: string,
  opts: { db?: Db } = {},
): Promise<ClientFieldView[]> {
  const db = opts.db ?? defaultPrisma;
  const [defs, values] = await Promise.all([
    db.customFieldDef.findMany({ where: { archived: false }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    db.clientCustomField.findMany({ where: { clientId } }),
  ]);
  const byField = new Map(values.map((v) => [v.fieldId, v.value]));
  return defs.map((d) => ({
    fieldId: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: d.options,
    value: byField.get(d.id) ?? null,
  }));
}

/**
 * Bulk-set a client's custom field values. Each entry is validated against its
 * definition's type; an empty value clears the field. Unknown/archived field
 * ids are rejected. Runs as one transaction.
 */
export async function setClientCustomFields(
  clientId: string,
  input: SetValuesInput,
  opts: { db?: Db; log?: Logger } = {},
) {
  const db = opts.db ?? defaultPrisma;
  const client = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } });
  if (!client) throw ApiError.notFound("Client not found");

  const defs = await db.customFieldDef.findMany({ where: { archived: false } });
  const defById = new Map(defs.map((d) => [d.id, d]));

  // Validate everything up front so a bad value fails the whole batch.
  const ops = input.values.map((entry) => {
    const def = defById.get(entry.fieldId);
    if (!def) throw ApiError.badRequest(`Unknown custom field: ${entry.fieldId}`);
    const raw = entry.value.trim();
    return { fieldId: entry.fieldId, clear: raw === "", value: raw === "" ? "" : coerceValue(def.type, raw, def.options) };
  });

  await runInTx(opts.db, async (tx) => {
    for (const op of ops) {
      if (op.clear) {
        await tx.clientCustomField.deleteMany({ where: { clientId, fieldId: op.fieldId } });
      } else {
        await tx.clientCustomField.upsert({
          where: { clientId_fieldId: { clientId, fieldId: op.fieldId } },
          create: { clientId, fieldId: op.fieldId, value: op.value },
          update: { value: op.value },
        });
      }
    }
  });
  opts.log?.debug({ clientId, count: ops.length }, "db write: client custom fields set");
  return getClientCustomFields(clientId, { db });
}
