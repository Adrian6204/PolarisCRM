import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BrandLockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { PreviewMock } from "@/components/landing/preview-mock";
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
  { value: "1-click", label: "global ⌘K search" },
  { value: "0", label: "spreadsheets required" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line backdrop-blur" style={{ backgroundColor: "color-mix(in srgb, var(--bg) 82%, transparent)" }}>
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-5 sm:px-6">
          <BrandLockup className="h-7 w-auto" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn btn-primary !py-1.5">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Faint dotted texture — monochrome, not a gradient wash. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(50rem 30rem at 50% 0%, #000, transparent 75%)",
              WebkitMaskImage: "radial-gradient(50rem 30rem at 50% 0%, #000, transparent 75%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-content px-5 pb-8 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="badge border border-line-strong text-muted">Polaris.Dev · internal CRM</span>
            <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Run the whole agency from one place.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
              Clients, pipelines, projects, calendar, and automations — a fast,
              focused CRM built for how Polaris.Dev actually works.
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <Link href="/login" className="btn btn-primary">Sign in</Link>
              <Link href="#features" className="btn btn-secondary">Explore features</Link>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-content px-5 pb-16 sm:px-6">
            <PreviewMock />
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid w-full max-w-content grid-cols-1 gap-6 px-5 py-10 sm:grid-cols-3 sm:px-6" data-stagger>
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-mono-nums text-3xl font-semibold tracking-tight">{s.value}</div>
                <div className="mt-1 text-sm text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto w-full max-w-content px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything the team needs, nothing it doesn&rsquo;t.</h2>
            <p className="mt-3 text-muted">One workspace for the full client lifecycle — from first lead to signed retainer to delivery.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-stagger>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card flex flex-col gap-3 p-5 transition-colors hover:border-line-strong">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface2 text-fg">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-content px-5 pb-20 sm:px-6">
          <div className="card flex flex-col items-center gap-5 p-10 text-center sm:p-14">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Ready to get to work?</h2>
            <p className="max-w-md text-muted">Sign in to your Polaris workspace and pick up right where the team left off.</p>
            <Link href="/login" className="btn btn-primary">Sign in</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-content flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <BrandLockup className="h-6 w-auto opacity-80" />
          <span>© {new Date().getFullYear()} Polaris.Dev · internal use only</span>
        </div>
      </footer>
    </div>
  );
}
