"use client";

import { Toaster as Sonner } from "sonner";

/**
 * App toaster (sonner), themed with the design tokens. Mounted once in the root
 * layout; call `toast.success(...)` / `toast.error(...)` from anywhere.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
        },
      }}
    />
  );
}

export { toast } from "sonner";
