"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PolarisMark } from "./brand";
import {
  IconDashboard,
  IconClients,
  IconProjects,
  IconDeliverables,
  IconPipeline,
} from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/clients", label: "Clients", icon: IconClients },
  { href: "/projects", label: "Projects", icon: IconProjects },
  { href: "/deliverables", label: "Deliverables", icon: IconDeliverables },
  { href: "/pipeline", label: "Pipeline", icon: IconPipeline },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Persistent desktop sidebar: brand + primary navigation with active state. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 py-5"
      >
        <PolarisMark className="h-6 w-6" />
        <span className="text-[15px] font-bold tracking-tight">Polaris</span>
        <span className="text-[15px] font-medium tracking-tight text-muted">CRM</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "" : "text-muted hover:bg-surface2 hover:text-fg"
              }`}
              style={
                active
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }
                  : undefined
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-muted">
        <span className="font-mono-nums">Polaris.Dev</span>
      </div>
    </aside>
  );
}

/** Compact horizontal nav shown on small screens (below the topbar). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 lg:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "text-brand" : "text-muted hover:text-fg"
            }`}
            style={active ? { backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" } : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
