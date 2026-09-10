"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { apiFetch } from "@/lib/api-client";

interface NotificationVM {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Topbar notification bell: shows an unread badge, polls periodically, and
 * opens a Radix popover listing recent notifications. Clicking one marks it
 * read and navigates; "Mark all read" clears the badge.
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationVM[]>([]);
  const [unread, setUnread] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ items: NotificationVM[]; unread: number }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* transient — keep last known state */
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function open(n: NotificationVM) {
    if (!n.readAt) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      apiFetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    }
    if (n.href) router.push(n.href);
  }

  async function markAll() {
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnread(0);
    await apiFetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-fg"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-fg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 overflow-hidden rounded-lg border border-line bg-bg shadow-md data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs link hover:underline">Mark all read</button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted">You&rsquo;re all caught up.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => open(n)}
                    className="flex w-full flex-col gap-0.5 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />}
                      {n.title}
                    </span>
                    {n.body && <span className="text-xs text-muted">{n.body}</span>}
                    <time className="text-[11px] text-muted" dateTime={n.createdAt}>
                      {new Date(n.createdAt).toLocaleString()}
                    </time>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
