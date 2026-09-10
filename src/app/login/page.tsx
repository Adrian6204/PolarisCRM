"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Credentials sign-in (NextAuth). First impression + first authenticated UI.
 * Centered card on a soft two-tone canvas, brand mark up top.
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-12" style={{ backgroundColor: "var(--surface)" }}>
      {/* Soft monochrome depth behind the card — two radial washes, no hue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 70%), radial-gradient(40rem 30rem at 100% 110%, color-mix(in srgb, var(--primary) 6%, transparent), transparent 70%)",
        }}
      />

      {/* No animation wrapper around the logo: an anim/transform ancestor forms
          a stacking context that would isolate the logo's mix-blend-mode and
          leave its white ground visible as a box. */}
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLockup className="h-auto w-56" />
        </div>

        <div
          className="animate-rise overflow-hidden rounded-xl border border-line bg-bg shadow-md"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {/* Hairline accent along the top edge of the card. */}
          <div aria-hidden className="h-1 w-full" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 45%, transparent), transparent)" }} />
          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted">Sign in to your Polaris workspace.</p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@polaris.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="field-label">Password</span>
                <PasswordInput
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p className="rounded-md px-3 py-2 text-sm text-red-600" style={{ backgroundColor: "color-mix(in srgb, #dc2626 8%, transparent)" }}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={pending} className="btn btn-primary mt-1 w-full">
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="link inline-flex items-center gap-1 hover:underline">
            <span aria-hidden>←</span> Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
