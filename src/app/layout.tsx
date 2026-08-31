import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polaris CRM",
  description: "Internal CRM for Polaris.Dev — clients, projects, deliverables.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
