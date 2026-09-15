import Groq from "groq-sdk";
import type { Role } from "@prisma/client";
import { env, groqModel } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { assistantTools, dispatchTool } from "./tools";
import { buildSystemPrompt } from "./prompt";

/**
 * Assistant chat orchestration. Runs a streaming tool-call loop against Groq:
 * the model may call read-only CRM tools (see ./tools) to ground its answer,
 * and the final prose streams to the client token-by-token. Tool rounds resolve
 * inline, so a plain help question costs a single streamed completion.
 *
 * The Groq key is read from env here and never leaves the server.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TOOL_ROUNDS = 3;
const TEMPERATURE = 0.3;
// Reserved output tokens count against Groq's per-minute token budget, so keep
// this modest — replies are short, and a lower cap means fewer rate-limit hits.
const MAX_TOKENS = 700;

// groq-sdk mirrors the OpenAI message shape; keep a loose local type.
type ConvoMessage = Record<string, unknown>;

/** The streamed-chunk shape we read (subset of the SDK's ChatCompletionChunk). */
type StreamChunk = {
  choices: {
    delta?: {
      content?: string | null;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True for Groq's rate-limit (429) errors. */
function isRateLimit(err: unknown): boolean {
  return (err as { status?: number })?.status === 429;
}

/** Seconds to wait from a 429's Retry-After header, if present. */
function retryAfterMs(err: unknown): number | null {
  const h = (err as { headers?: unknown })?.headers as
    | { get?: (k: string) => string | null }
    | Record<string, string>
    | undefined;
  const raw =
    typeof h?.get === "function" ? h.get("retry-after") : (h as Record<string, string>)?.["retry-after"];
  const secs = raw ? Number(raw) : NaN;
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) : null;
}

/**
 * Create a completion, retrying transient 429s. Groq's token bucket refills in
 * well under a second on this tier, so a short wait usually clears the limit.
 */
async function createWithRetry(
  groq: Groq,
  params: Parameters<Groq["chat"]["completions"]["create"]>[0],
  retries = 2,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err) {
      if (isRateLimit(err) && attempt < retries) {
        await sleep(Math.min(retryAfterMs(err) ?? 1200, 4000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Return a ReadableStream of the assistant's reply text. Tool calls are executed
 * server-side between streamed rounds. Errors are surfaced as a short trailing
 * note rather than a broken stream.
 */
export async function streamAssistantReply(opts: {
  messages: ChatMessage[];
  user: { name: string | null; role: Role };
  log?: Logger;
}): Promise<ReadableStream<Uint8Array>> {
  const { messages, user, log } = opts;
  const groq = new Groq({ apiKey: env.GROQ_API_KEY });

  const convo: ConvoMessage[] = [
    { role: "system", content: buildSystemPrompt(user) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const isLastRound = round === MAX_TOOL_ROUNDS - 1;
          const stream = (await createWithRetry(groq, {
            model: groqModel,
            messages: convo as never,
            // On the final permitted round, drop tools so the model must answer.
            tools: isLastRound ? undefined : (assistantTools as never),
            tool_choice: isLastRound ? undefined : "auto",
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stream: true,
          } as never)) as unknown as AsyncIterable<StreamChunk>;

          // Accumulate any tool calls by index (arguments arrive in fragments).
          const toolCalls = new Map<number, { id: string; name: string; args: string }>();
          let sawContent = false;

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
              sawContent = true;
              controller.enqueue(encoder.encode(delta.content));
            }
            for (const tc of delta?.tool_calls ?? []) {
              const slot = toolCalls.get(tc.index) ?? { id: "", name: "", args: "" };
              if (tc.id) slot.id = tc.id;
              if (tc.function?.name) slot.name = tc.function.name;
              if (tc.function?.arguments) slot.args += tc.function.arguments;
              toolCalls.set(tc.index, slot);
            }
          }

          // If the model asked for tools (and didn't also stream prose), run them
          // and loop; otherwise the answer has already streamed and we're done.
          if (toolCalls.size > 0 && !sawContent) {
            const calls = [...toolCalls.values()];
            convo.push({
              role: "assistant",
              content: "",
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: c.args || "{}" },
              })),
            });
            for (const c of calls) {
              let parsed: Record<string, unknown> = {};
              try {
                parsed = c.args ? JSON.parse(c.args) : {};
              } catch {
                /* malformed args → dispatch handles the empty object */
              }
              log?.debug({ tool: c.name }, "assistant tool call");
              const result = await dispatchTool(c.name, parsed);
              convo.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
            }
            continue;
          }

          break;
        }
      } catch (err) {
        log?.error({ err }, "assistant stream error");
        const msg = isRateLimit(err)
          ? "\n\nI'm being rate-limited right now (the model's free-tier token limit). Please wait a few seconds and try again."
          : "\n\nSorry, I hit an error. Please try again.";
        controller.enqueue(encoder.encode(msg));
      } finally {
        controller.close();
      }
    },
  });
}
