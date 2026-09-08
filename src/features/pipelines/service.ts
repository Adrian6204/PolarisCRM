import type { Prisma, PrismaClient } from "@prisma/client";
import { StageKind } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import type { Logger } from "@/lib/logger";
import { shortText } from "@/lib/validation";
import { runInTx } from "@/lib/tx";

/**
 * Pipeline + stage business logic (G2). A pipeline is a named funnel; its
 * ordered stages carry a `kind` (open/won/lost) so terminal semantics survive
 * arbitrary names. Exactly one pipeline is the default (used by dashboard /
 * analytics single-funnel views). Stages and pipelines that still carry deals
 * cannot be deleted (the FK is RESTRICT; the service reports a clean 409).
 */
type Db = PrismaClient | Prisma.TransactionClient;

const KINDS = Object.values(StageKind) as [StageKind, ...StageKind[]];

const stageInputSchema = z.object({
  name: shortText(40),
  kind: z.enum(KINDS).default(StageKind.open),
});

export const createPipelineSchema = z.object({
  name: shortText(60),
  // Optional custom stages; when omitted a sensible default set is created.
  stages: z.array(stageInputSchema).max(20).optional(),
});

export const updatePipelineSchema = z
  .object({
    name: shortText(60).optional(),
    archived: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const createStageSchema = stageInputSchema;
export const updateStageSchema = z
  .object({
    name: shortText(40).optional(),
    kind: z.enum(KINDS).optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field must be provided" });

export const reorderStagesSchema = z.object({ stageIds: z.array(z.string().min(1)).min(1) });

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

const DEFAULT_STAGES = [
  { name: "Lead", kind: StageKind.open },
  { name: "Proposal", kind: StageKind.open },
  { name: "Won", kind: StageKind.won },
  { name: "Lost", kind: StageKind.lost },
];

const withStages = {
  stages: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.PipelineInclude;

export type PipelineWithStages = Prisma.PipelineGetPayload<{ include: typeof withStages }>;

export async function listPipelines(opts: { db?: Db; includeArchived?: boolean } = {}) {
  const db = opts.db ?? defaultPrisma;
  return db.pipeline.findMany({
    where: opts.includeArchived ? {} : { archived: false },
    include: withStages,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getPipeline(id: string, opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const pipeline = await db.pipeline.findUnique({ where: { id }, include: withStages });
  if (!pipeline) throw ApiError.notFound("Pipeline not found");
  return pipeline;
}

/** The default pipeline, falling back to the first non-archived one. */
export async function getDefaultPipeline(opts: { db?: Db } = {}) {
  const db = opts.db ?? defaultPrisma;
  const pipeline =
    (await db.pipeline.findFirst({ where: { isDefault: true }, include: withStages })) ??
    (await db.pipeline.findFirst({
      where: { archived: false },
      include: withStages,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }));
  if (!pipeline) throw ApiError.notFound("No pipeline configured");
  return pipeline;
}

export async function createPipeline(input: CreatePipelineInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const stages = (input.stages?.length ? input.stages : DEFAULT_STAGES).map((s, i) => ({
    name: s.name,
    kind: s.kind,
    sortOrder: i,
  }));
  const pipeline = await db.pipeline.create({
    data: { name: input.name, stages: { create: stages } },
    include: withStages,
  });
  opts.log?.debug({ pipelineId: pipeline.id }, "db write: pipeline created");
  return pipeline;
}

export async function updatePipeline(id: string, input: UpdatePipelineInput, opts: { db?: Db; log?: Logger } = {}) {
  return runInTx(opts.db, async (tx) => {
    // Promoting a pipeline to default demotes the others.
    if (input.isDefault === true) {
      await tx.pipeline.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }
    const res = await tx.pipeline.updateMany({ where: { id }, data: input });
    if (res.count === 0) throw ApiError.notFound("Pipeline not found");
    opts.log?.debug({ pipelineId: id }, "db write: pipeline updated");
    return tx.pipeline.findUnique({ where: { id }, include: withStages });
  });
}

export async function deletePipeline(id: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const deals = await db.deal.count({ where: { pipelineId: id, deletedAt: null } });
  if (deals > 0) throw ApiError.conflict("Pipeline still has deals; move or delete them first");
  const res = await db.pipeline.deleteMany({ where: { id } });
  if (res.count === 0) throw ApiError.notFound("Pipeline not found");
  opts.log?.debug({ pipelineId: id }, "db write: pipeline deleted");
}

// --- Stages ---------------------------------------------------------------

export async function addStage(pipelineId: string, input: CreateStageInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const pipeline = await db.pipeline.findUnique({ where: { id: pipelineId }, select: { id: true } });
  if (!pipeline) throw ApiError.notFound("Pipeline not found");
  const last = await db.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const stage = await db.pipelineStage.create({
    data: { pipelineId, name: input.name, kind: input.kind, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  opts.log?.debug({ stageId: stage.id, pipelineId }, "db write: stage added");
  return stage;
}

export async function updateStage(stageId: string, input: UpdateStageInput, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const res = await db.pipelineStage.updateMany({ where: { id: stageId }, data: input });
  if (res.count === 0) throw ApiError.notFound("Stage not found");
  opts.log?.debug({ stageId }, "db write: stage updated");
  return db.pipelineStage.findUnique({ where: { id: stageId } });
}

export async function deleteStage(stageId: string, opts: { db?: Db; log?: Logger } = {}) {
  const db = opts.db ?? defaultPrisma;
  const deals = await db.deal.count({ where: { stageId, deletedAt: null } });
  if (deals > 0) throw ApiError.conflict("Stage still has deals; move them to another stage first");
  const res = await db.pipelineStage.deleteMany({ where: { id: stageId } });
  if (res.count === 0) throw ApiError.notFound("Stage not found");
  opts.log?.debug({ stageId }, "db write: stage deleted");
}

/** Persist a new stage order (array of stage ids in the desired order). */
export async function reorderStages(pipelineId: string, stageIds: string[], opts: { db?: Db; log?: Logger } = {}) {
  await runInTx(opts.db, async (tx) => {
    const owned = await tx.pipelineStage.findMany({ where: { pipelineId }, select: { id: true } });
    const ownedIds = new Set(owned.map((s) => s.id));
    if (stageIds.length !== ownedIds.size || stageIds.some((id) => !ownedIds.has(id))) {
      throw ApiError.badRequest("stageIds must be exactly the pipeline's stages");
    }
    await Promise.all(
      stageIds.map((id, i) => tx.pipelineStage.update({ where: { id }, data: { sortOrder: i } })),
    );
  });
  opts.log?.debug({ pipelineId }, "db write: stages reordered");
}
