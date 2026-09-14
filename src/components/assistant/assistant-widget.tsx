"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Floating in-app assistant. A launcher (bottom-right) opens a chat panel
 * available on every authenticated page. Replies stream token-by-token from
 * /api/assistant. Read-only: the assistant answers and guides, it never writes.
 */
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which retainers renew soon?",
  "Show me active clients",
  "What's the status of my deliverables?",
];

export function AssistantWidget() {
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
    // Optimistically add the user turn plus an empty assistant turn to stream into.
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
      if (!acc.trim()) setMessages((m) => setLast(m, "(no response)"));
    } catch {
      setMessages((m) => setLast(m, "Sorry, something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="btn btn-primary fixed bottom-6 right-6 z-40 h-12 w-12 !rounded-full !p-0 shadow-md"
      >
        {open ? <IconClose /> : <IconChat />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Polaris assistant"
          className="card fixed bottom-24 right-6 z-40 flex h-[560px] max-h-[calc(100vh-8rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden animate-pop-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Assistant</span>
              <span className="text-xs text-muted">Answers about your CRM</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="btn btn-ghost !p-1.5"
            >
              <IconClose />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Hi! Ask me about your clients, projects, deals, tasks, or renewals, or how to get
                  around the CRM.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="panel rounded-md px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} busy={busy && i === messages.length - 1} />)
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
            <div className="flex items-end gap-2">
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
                placeholder="Ask anything…"
                className="input max-h-32 min-h-[2.5rem] flex-1 resize-none"
              />
              <button type="submit" disabled={!input.trim() || busy} className="btn btn-primary !p-2.5" aria-label="Send">
                <IconSend />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Replace the content of the last message (the streaming assistant turn). */
function setLast(msgs: Msg[], content: string): Msg[] {
  if (msgs.length === 0) return msgs;
  const copy = msgs.slice();
  copy[copy.length - 1] = { ...copy[copy.length - 1], content };
  return copy;
}

function Bubble({ msg, busy }: { msg: Msg; busy: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-brand text-brand-fg" : "panel text-fg"
        }`}
      >
        {msg.content || (busy ? <span className="text-muted">Thinking…</span> : null)}
      </div>
    </div>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
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
