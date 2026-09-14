import { z } from "zod";
import { withApiRoute, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import { hasAssistant } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { streamAssistantReply } from "@/features/assistant/service";

/**
 * /api/assistant — the in-app chat assistant (read-only, Groq-backed).
 * Streams the reply as plain text. Auth required; rate limited per user because
 * LLM calls are comparatively expensive. Hidden/disabled when GROQ is unset.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep the most recent turns to bound context/token cost.
const MAX_TURNS = 16;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export const POST = withApiRoute(async ({ req, log }) => {
  if (!hasAssistant) throw new ApiError("bad_request", "Assistant is not configured");

  const user = await requireUser();

  // Per-user throttle (LLM cost); keyed on the user, not IP.
  const rl = await enforceRateLimit("write", `assistant:${user.id}`);
  if (!rl.success) throw new ApiError("rate_limited", "You're sending messages too quickly. Please slow down.");

  const { messages } = await parseJson(req, bodySchema);

  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });

  const stream = await streamAssistantReply({
    messages: messages.slice(-MAX_TURNS),
    user: { name: profile?.name ?? null, role: user.role },
    log,
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
});
