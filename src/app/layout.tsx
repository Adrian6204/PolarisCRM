import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { themeInitScript } from "@/components/theme-toggle";
import { sans, mono } from "@/lib/fonts";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Polaris CRM",
  description: "Internal CRM for Polaris.Dev — clients, projects, deliverables.",
};

// Needs the session to decide whether to render the authenticated shell.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Set the theme before paint to avoid a flash of the wrong mode. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <Providers>
          {user ? <AppShell>{children}</AppShell> : children}
        </Providers>
      </body>
    </html>
  );
}
