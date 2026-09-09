"use client";

import * as React from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle. Drop-in replacement for
 * `<input type="password" className="input" />` — forwards all input props and
 * keeps the eye button inside the field, out of the text's way.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("input pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-fg"
      >
        {show ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
