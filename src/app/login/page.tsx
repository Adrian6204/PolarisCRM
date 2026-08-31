/**
 * Minimal placeholder sign-in page. NextAuth redirects unauthenticated users
 * here (see authOptions.pages.signIn). A proper credential form is fleshed out
 * alongside the first authenticated feature UI in Phase 1.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-gray-500">
        Authentication is configured (NextAuth credentials). The sign-in form is
        built out in Phase 1.
      </p>
    </main>
  );
}
