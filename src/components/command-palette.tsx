"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { apiFetch } from "@/lib/api-client";
import type { SearchResult, SearchType } from "@/features/search/service";
import {
  IconDashboard, IconClients, IconProjects, IconDeliverables,
  IconPipeline, IconCalendar, IconAnalytics, IconSettings,
} from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/clients", label: "Clients", icon: IconClients },
  { href: "/projects", label: "Projects", icon: IconProjects },
  { href: "/deliverables", label: "Deliverables", icon: IconDeliverables },
  { href: "/pipeline", label: "Pipeline", icon: IconPipeline },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/analytics", label: "Analytics", icon: IconAnalytics },
  { href: "/settings/team", label: "Settings", icon: IconSettings },
];

const TYPE_LABEL: Record<SearchType, string> = {
  client: "Clients",
  contact: "Contacts",
  deal: "Deals",
  project: "Projects",
};
const TYPE_ORDER: SearchType[] = ["client", "contact", "deal", "project"];

/**
 * ⌘K / Ctrl-K command palette: jump to any page, or search clients, contacts,
 * deals and projects live. Mounted once in the app shell.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Global ⌘K / Ctrl-K toggle, plus a custom event the topbar button fires.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onToggle = () => setOpen((o) => !o);
    document.addEventListener("keydown", onKey);
    document.addEventListener("command-palette:toggle", onToggle);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("command-palette:toggle", onToggle);
    };
  }, []);

  // Debounced search as the user types.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await apiFetch<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const q = query.trim().toLowerCase();
  // Nav is always reachable — filtered while typing, all shown when empty.
  const navMatches = q ? NAV.filter((n) => n.label.toLowerCase().includes(q)) : NAV;
  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  const hasAny = navMatches.length > 0 || grouped.length > 0;
  const showEmpty = !!q && !loading && !hasAny;
  // Scope heading styling to the heading element only — putting `uppercase`/
  // `tracking` on the whole group cascades into items and shrieks them in caps.
  const groupHeading =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted";
  const itemClass =
    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-fg outline-none aria-selected:bg-surface2 aria-selected:text-fg";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 top-[12%] z-50 mx-auto w-[calc(100vw-2rem)] max-w-xl overflow-hidden rounded-xl border border-line-strong bg-bg shadow-md data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out"
          aria-label="Command palette"
        >
          <DialogPrimitive.Title className="sr-only">Search and navigate</DialogPrimitive.Title>
          <Command shouldFilter={false} className="flex flex-col">
            {/* Input row with a leading magnifier + inline loading spinner. */}
            <div className="flex items-center gap-2.5 border-b border-line px-3.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-[18px] w-[18px] shrink-0 text-muted">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search clients, contacts, deals, projects…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              {loading && (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-transparent" aria-hidden />
              )}
            </div>

            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
              {showEmpty && (
                <div className="px-2 py-10 text-center text-sm text-muted">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </div>
              )}

              {navMatches.length > 0 && (
                <Command.Group heading="Go to" className={groupHeading}>
                  {navMatches.map(({ href, label, icon: Icon }) => (
                    <Command.Item key={href} value={`nav ${label}`} onSelect={() => go(href)} className={itemClass}>
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      {label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {grouped.map((g) => (
                <Command.Group key={g.type} heading={TYPE_LABEL[g.type]} className={groupHeading}>
                  {g.items.map((r) => (
                    <Command.Item key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)} className={itemClass}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.subtitle && <span className="truncate text-xs text-muted">{r.subtitle}</span>}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>

            {/* Keyboard hints footer. */}
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-muted">
              <span><kbd className="font-mono-nums">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono-nums">↵</kbd> open</span>
              <span><kbd className="font-mono-nums">esc</kbd> close</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Topbar trigger button that hints the ⌘K shortcut. */
export function CommandPaletteButton() {
  function trigger() {
    document.dispatchEvent(new CustomEvent("command-palette:toggle"));
  }
  return (
    <button
      onClick={trigger}
      className="flex items-center gap-2 rounded-md border border-line-strong bg-bg px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
      aria-label="Open search"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="h-4 w-4">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <span className="hidden sm:inline">Search</span>
    </button>
  );
}
