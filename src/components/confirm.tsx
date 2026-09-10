"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Imperative confirm dialog to replace window.confirm(). A provider mounts one
 * Radix AlertDialog; `useConfirm()` returns an async `confirm(opts)` that
 * resolves to true/false. Themed with the design tokens; destructive actions
 * get a red confirm button.
 */
interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = React.createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions>({});
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    setOpen(false);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(o) => !o && settle(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in" />
          <AlertDialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
              "card flex flex-col gap-4 p-5 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
            )}
          >
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-base font-semibold">
                {opts.title ?? "Are you sure?"}
              </AlertDialog.Title>
              {opts.description && (
                <AlertDialog.Description className="text-sm text-muted">
                  {opts.description}
                </AlertDialog.Description>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="btn btn-secondary !py-1.5">{opts.cancelLabel ?? "Cancel"}</button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => settle(true)}
                  className={cn("btn !py-1.5", opts.destructive ? "btn-danger" : "btn-primary")}
                >
                  {opts.confirmLabel ?? "Confirm"}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return React.useContext(ConfirmContext);
}
