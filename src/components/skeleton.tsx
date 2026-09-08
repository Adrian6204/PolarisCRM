/**
 * Loading skeletons. Rendered instantly by Next's `loading.tsx` on navigation
 * while the server component awaits data — so pages feel immediate even when a
 * remote-DB round-trip takes ~1s. Pure CSS pulse (reduced-motion aware).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

function Header() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

function Tiles({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-2 p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function Cards({ n = 4, tall = false }: { n?: number; tall?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className={tall ? "h-56 w-full" : "h-32 w-full"} />
        </div>
      ))}
    </div>
  );
}

function Rows({ n = 6 }: { n?: number }) {
  return (
    <div className="card flex flex-col divide-y divide-line overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function Board({ cols = 4 }: { cols?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-col gap-2 rounded-lg bg-surface p-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

type Variant = "cards" | "table" | "board" | "detail" | "analytics";

/** A full-page loading placeholder matching the shape of the target page. */
export function PageSkeleton({ variant }: { variant: Variant }) {
  return (
    <div className="flex flex-col gap-8">
      <Header />
      {variant === "analytics" && (
        <>
          <Tiles n={6} />
          <Cards n={4} tall />
        </>
      )}
      {variant === "cards" && <Cards n={4} />}
      {variant === "table" && (
        <>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-40" />
          </div>
          <Rows n={6} />
        </>
      )}
      {variant === "board" && <Board />}
      {variant === "detail" && (
        <div className="flex max-w-lg flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </div>
  );
}
