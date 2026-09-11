"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  IconClients, IconPipeline, IconCalendar, IconAnalytics, IconSettings,
} from "@/components/icons";

/**
 * First-run welcome / release-notes modal. Shows once per browser for a given
 * app version (persisted in localStorage), so it greets a user after their
 * first sign-in and never nags afterwards. Bump APP_VERSION to re-announce a
 * future release with a fresh "what's new".
 */
export const APP_VERSION = "1.0.0";
const SEEN_KEY = `polaris.welcome.v${APP_VERSION}`;

const SearchGlyph = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const FEATURES = [
  { icon: IconClients, title: "Clients & contacts", body: "Tags, notes, custom fields, a unified activity timeline, duplicate-merge, and CSV import/export." },
  { icon: IconPipeline, title: "Pipelines & deals", body: "Configurable pipelines with custom stages, and live win-rate as deals move." },
  { icon: IconCalendar, title: "Calendar & booking", body: "Availability-based scheduling, per-client appointments, and reminders." },
  { icon: IconAnalytics, title: "Analytics", body: "KPIs, win rate, sales-cycle time, and a per-owner leaderboard over any range." },
  { icon: IconSettings, title: "Automations & team", body: "Trigger → action rules, in-app notifications, and role-based access control." },
  { icon: SearchGlyph, title: "Fast by default", body: "Keyboard-fast global search, file attachments, light & dark, and a full audit trail." },
];

export function WelcomeDialog() {
  const [open, setOpen] = React.useState(false);

  // Check on mount (client only) so there's no SSR/hydration mismatch, and
  // let anywhere in the app re-open it on demand ("What's new").
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* localStorage unavailable — just don't show it */
    }
    const onOpen = () => setOpen(true);
    document.addEventListener("welcome:open", onOpen);
    return () => document.removeEventListener("welcome:open", onOpen);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <DialogTitle>Welcome to Polaris CRM</DialogTitle>
            <span className="badge border border-line-strong font-mono-nums text-muted">v{APP_VERSION}</span>
          </div>
          <DialogDescription>
            The inaugural release — your whole agency, from first lead to signed
            retainer to delivery, in one workspace. Here&rsquo;s what&rsquo;s inside.
          </DialogDescription>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-fg">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end">
          <button onClick={dismiss} className="btn btn-primary">Get started</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
