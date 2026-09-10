import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandLockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { PreviewMock } from "@/components/landing/preview-mock";
import { CloserLook } from "@/components/landing/screens";
import {
  IconClients, IconPipeline, IconProjects, IconCalendar, IconAnalytics, IconSettings,
} from "@/components/icons";

/**
 * Public landing page — the showcase surface for Polaris CRM. Signed-in users
 * skip straight to the dashboard. Built in the app's locked monochrome
 * language (borders + faint shadows, tabular figures, restrained motion — no
 * gradient text or glow), so the marketing page reads as the same product.
 */
export const metadata: Metadata = {
  title: "Polaris CRM — the agency operating system",
  description:
    "Clients, pipelines, projects, calendar, and automations — a fast, focused CRM built for how Polaris.Dev works.",
};

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: IconClients, title: "Clients & contacts", body: "Rich records with tags, notes, custom fields, and a unified activity timeline." },
  { icon: IconPipeline, title: "Pipelines & deals", body: "Configurable pipelines with custom stages; drag deals forward and track win rate." },
  { icon: IconProjects, title: "Projects & delivery", body: "Engagements, deliverables, and per-service workflows from kickoff to done." },
  { icon: IconCalendar, title: "Calendar & booking", body: "Availability-based scheduling with per-client appointments and reminders." },
  { icon: IconAnalytics, title: "Analytics & reporting", body: "Pipeline value, win rate, sales-cycle time, and a per-owner leaderboard." },
  { icon: IconSettings, title: "Automations & team", body: "Trigger → action rules, in-app notifications, and role-based access control." },
];

const STATS = [
  { value: "6", label: "workspaces, one login" },
  { value: "1-click", label: "global keyboard search" },
  { value: "0", label: "spreadsheets required" },
];

// Illustrative, role-based quotes (placeholders) — swap for real ones anytime.
const VOICES = [
  { quote: "Every client's history, deals, and files are one search away. I stopped hunting through folders.", role: "Account lead" },
  { quote: "The pipeline and win-rate view finally match how we actually sell. Moving a deal takes a second.", role: "Sales" },
  { quote: "Automations quietly tag and log for us, and role-based access keeps the whole studio tidy.", role: "Studio admin" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  // Normal document flow (no scroll-snap), sections sized to content — pure
  // black/white surfaces with hairline borders for structure, no gray fills.
  const section = "border-t border-line px-5 py-16 sm:px-6 sm:py-20";
  const inner = "mx-auto w-full max-w-content";

  return (
    <div className="bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-line backdrop-blur" style={{ backgroundColor: "color-mix(in srgb, var(--bg) 82%, transparent)" }}>
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-5 sm:px-6">
          <BrandLockup className="h-auto w-44" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn btn-primary !py-1.5">Sign in</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 py-16 text-center sm:px-6 sm:py-20">
        <div className={inner}>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            The operating system for the whole agency.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
            Leads to retainers to delivery — clients, pipelines, projects,
            calendar, and automations in one fast workspace, not seven tabs
            and a spreadsheet.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link href="/login" className="btn btn-primary">Sign in</Link>
            <Link href="#features" className="btn btn-secondary">Explore features</Link>
          </div>
          <div className="mt-10">
            <PreviewMock />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={section}>
        <div className={`grid grid-cols-1 gap-8 sm:grid-cols-3 ${inner}`} data-stagger>
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-mono-nums text-4xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={section}>
        <div className={inner}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything the team needs, nothing it doesn&rsquo;t.</h2>
            <p className="mt-3 text-muted">One workspace for the full client lifecycle — from first lead to signed retainer to delivery.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card flex flex-col gap-3 p-5 transition-colors hover:border-line-strong">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong text-fg">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* A closer look */}
      <section className={section}>
        <div className={inner}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">A closer look</h2>
            <p className="mt-3 text-muted">The same monochrome, keyboard-fast UI across every surface.</p>
          </div>
          <div className="mt-10">
            <CloserLook />
          </div>
        </div>
      </section>

      {/* Voices */}
      <section className={section}>
        <div className={inner}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for every role on the team</h2>
            <p className="mt-3 text-muted">One workspace that works the way each person does.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3" data-stagger>
            {VOICES.map((v) => (
              <figure key={v.role} className="card flex flex-col gap-4 p-6">
                <blockquote className="text-sm leading-relaxed">&ldquo;{v.quote}&rdquo;</blockquote>
                <figcaption className="mt-auto flex items-center gap-2 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong font-mono-nums text-xs font-semibold">
                    {v.role.slice(0, 1)}
                  </span>
                  <span className="text-muted">{v.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={section}>
        <div className={`card flex flex-col items-center gap-5 p-10 text-center sm:p-14 ${inner}`}>
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Ready to get to work?</h2>
          <p className="max-w-md text-muted">Sign in to your Polaris workspace and pick up right where the team left off.</p>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
          <p className="text-xs text-muted">
            No account yet? Access is invite-only —{" "}
            <a href="mailto:admin@polaris.dev?subject=Polaris%20CRM%20access%20request" className="link hover:underline">
              request access from an admin
            </a>
            .
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-content flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <BrandLockup className="h-auto w-36 opacity-80" />
          <span>© {new Date().getFullYear()} Polaris.Dev</span>
        </div>
      </footer>
    </div>
  );
}
