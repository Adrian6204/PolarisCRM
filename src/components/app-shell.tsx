import { Sidebar, MobileNav } from "./sidebar";
import { PolarisMark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Authenticated app shell: persistent sidebar (desktop) / compact nav (mobile),
 * a sticky topbar with theme toggle + identity, and the page canvas.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar />
      <div className="flex min-h-screen flex-col">
        <header
          className="sticky top-0 z-20 border-b border-line backdrop-blur"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
        >
          <div className="flex h-14 items-center justify-between px-5">
            <div className="flex items-center gap-2 lg:hidden">
              <PolarisMark className="h-5 w-5" />
              <span className="text-sm font-bold tracking-tight">Polaris</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <div className="mx-1 h-6 w-px bg-line" />
              <UserMenu />
            </div>
          </div>
        </header>
        <MobileNav />
        <main className="mx-auto w-full max-w-content flex-1 px-5 py-8 sm:px-6 animate-rise">
          {children}
        </main>
      </div>
    </div>
  );
}
