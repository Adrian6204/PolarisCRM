"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLockup } from "@/components/brand";

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
    <main className="grid min-h-screen place-items-center px-6 py-12" style={{ backgroundColor: "var(--surface)" }}>
      {/* No animation wrapper around the logo: an anim/transform ancestor forms
          a stacking context that would isolate the logo's mix-blend-mode and
          leave its white ground visible as a box. */}
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <BrandLockup className="h-auto w-64" />
          <p className="text-sm text-muted">Sign in to your workspace</p>
        </div>

        <div className="card animate-rise p-6 sm:p-7">
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
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
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

        <p className="mt-6 text-center text-xs text-muted">
          Polaris.Dev · internal use only
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
