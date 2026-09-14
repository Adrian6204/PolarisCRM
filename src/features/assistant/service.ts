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

const MAX_TOOL_ROUNDS = 4;
const TEMPERATURE = 0.3;
const MAX_TOKENS = 1024;

// groq-sdk mirrors the OpenAI message shape; keep a loose local type.
type ConvoMessage = Record<string, unknown>;

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
          const stream = await groq.chat.completions.create({
            model: groqModel,
            messages: convo as never,
            // On the final permitted round, drop tools so the model must answer.
            tools: isLastRound ? undefined : assistantTools,
            tool_choice: isLastRound ? undefined : "auto",
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            stream: true,
          });

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
        controller.enqueue(encoder.encode("\n\nSorry, I hit an error. Please try again."));
      } finally {
        controller.close();
      }
    },
  });
}
