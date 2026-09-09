"use client";

import { SessionProvider } from "next-auth/react";
import { ConfirmProvider } from "@/components/confirm";
import { Toaster } from "@/components/ui/toaster";

/** App-wide client providers: session, confirm dialog, and toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>
        {children}
        <Toaster />
      </ConfirmProvider>
    </SessionProvider>
  );
}
