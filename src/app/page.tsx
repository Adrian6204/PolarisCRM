/**
 * Placeholder landing page for Phase 0. Feature UIs (client list, project
 * boards, dashboards) are added in their respective phases.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Polaris CRM</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Infra scaffolding is in place. Feature phases (Clients, Projects,
        Deliverables, …) build on top of this.
      </p>
      <p className="text-sm text-gray-500">
        Health check:{" "}
        <a className="underline" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
