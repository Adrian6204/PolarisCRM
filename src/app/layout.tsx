import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { UserMenu } from "@/components/user-menu";

export const metadata: Metadata = {
  title: "Polaris CRM",
  description: "Internal CRM for Polaris.Dev — clients, projects, deliverables.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <header className="border-b border-gray-200 dark:border-gray-800">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
              <div className="flex items-center gap-6">
                <Link href="/" className="font-semibold tracking-tight">
                  Polaris CRM
                </Link>
                <Link
                  href="/clients"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Clients
                </Link>
                <Link
                  href="/projects"
                  className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Projects
                </Link>
              </div>
              <UserMenu />
            </nav>
          </header>
          <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
