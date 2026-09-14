"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Floating in-app assistant. A launcher (bottom-right) opens a chat panel
 * available on every authenticated page. Replies stream token-by-token from
 * /api/assistant and render as Markdown. Read-only: it answers and guides,
 * never writes. Links to CRM records navigate in-app.
 */
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which retainers renew soon?",
  "Show me active clients",
  "Summarize what's happening with a client",
];

export function AssistantWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const msg =
          res.status === 429
            ? "You're sending messages too quickly. Please slow down."
            : "Sorry, I couldn't reach the assistant. Please try again.";
        setMessages((m) => setLast(m, msg));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => setLast(m, acc));
      }
      if (!acc.trim()) setMessages((m) => setLast(m, "_(no response)_"));
    } catch {
      setMessages((m) => setLast(m, "Sorry, something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="btn btn-primary fixed bottom-6 right-6 z-40 h-12 w-12 !rounded-full !p-0 shadow-md transition-transform hover:scale-105"
      >
        {open ? <IconClose /> : <IconPolaris size={22} />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Polaris assistant"
          className="card fixed bottom-24 right-6 z-40 flex h-[600px] max-h-[calc(100vh-8rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden animate-pop-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-fg">
                <IconPolaris size={17} />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Polaris Assistant</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online · read-only
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="btn btn-ghost !px-2 !py-1 text-xs"
                  title="New chat"
                >
                  New chat
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn btn-ghost !p-1.5">
                <IconClose />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Hi! I can answer questions about your clients, projects, deals, tasks, and renewals, or
                  help you get around the CRM. Try one of these:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="panel flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface2"
                    >
                      <span className="text-muted">
                        <IconArrow />
                      </span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <Bubble key={i} msg={m} busy={busy && i === messages.length - 1} router={router} onClose={() => setOpen(false)} />
              ))
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-1.5 rounded-xl border border-line-strong bg-bg px-2 py-1.5 transition-colors focus-within:border-fg">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about your CRM…"
                className="max-h-32 min-h-[1.75rem] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-fg outline-none placeholder:text-muted"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="btn btn-primary !rounded-lg !p-2 shrink-0"
                aria-label="Send"
              >
                <IconSend />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-muted">
              Polaris can make mistakes. Verify important details.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function setLast(msgs: Msg[], content: string): Msg[] {
  if (msgs.length === 0) return msgs;
  const copy = msgs.slice();
  copy[copy.length - 1] = { ...copy[copy.length - 1], content };
  return copy;
}

function Bubble({
  msg,
  busy,
  router,
  onClose,
}: {
  msg: Msg;
  busy: boolean;
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand px-3 py-2 text-sm text-brand-fg">
          {msg.content}
        </div>
      </div>
    );
  }

  // Assistant: typing indicator until the first token arrives, then Markdown.
  const empty = !msg.content;
  return (
    <div className="group flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface2 text-fg">
        <IconPolaris size={15} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-fg shadow-sm">
          {empty && busy ? (
            <TypingDots />
          ) : (
            <div className="chat-md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    const url = href ?? "";
                    const internal = url.startsWith("/");
                    if (internal) {
                      return (
                        <a
                          href={url}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(url);
                            onClose();
                          }}
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!empty && !busy && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(msg.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="w-fit px-1 text-[11px] text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

/** The Polaris north-star mark, drawn with currentColor so it inherits the
 *  parent's text color (visible on the brand launcher and neutral avatar). */
function IconPolaris({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1.6c.5 4.9 2.4 7.2 8.9 8.1v.2c-6.5.9-8.4 3.2-8.9 8.1h-.2c-.5-4.9-2.4-7.2-8.9-8.1v-.2c6.5-.9 8.4-3.2 8.9-8.1h.2Z" />
      <path
        d="M18.8 15.2c.2 1.9.9 2.8 3.4 3.1v.1c-2.5.3-3.2 1.2-3.4 3.1h-.1c-.2-1.9-.9-2.8-3.4-3.1v-.1c2.5-.3 3.2-1.2 3.4-3.1h.1Z"
        opacity="0.55"
      />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
