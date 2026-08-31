/**
 * Presentational analytics pieces (no client JS): KPI stat tiles, the chart-card
 * frame, a plain-HTML composition bar, and a legend. Kept server-renderable.
 */

/** A headline number — the "not a chart" form for a single magnitude. */
export function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "good" | "bad" | "warn";
}) {
  const toneVar =
    tone === "good" ? "var(--chart-good)" : tone === "bad" ? "var(--chart-bad)" : tone === "warn" ? "var(--chart-warn)" : undefined;
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span
        className="font-mono-nums text-3xl font-semibold tabular-nums"
        style={toneVar ? { color: toneVar } : undefined}
      >
        {value}
      </span>
      {caption && <span className="text-xs text-muted">{caption}</span>}
    </div>
  );
}

/** Frame around a chart: title, one-line caption, the plot. */
export function ChartCard({
  title,
  caption,
  children,
  className = "",
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col gap-4 p-5 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {caption && <p className="text-xs text-muted">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string; // a chart ramp CSS var
}

/**
 * Horizontal composition bar (100% width = total). Segments are separated by a
 * 2px surface gap; each carries its count directly (the relief the light ramp
 * steps require). A legend names every segment so identity is never colour-alone.
 */
export function CompositionBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  return (
    <div className="flex flex-col gap-3">
      {total === 0 ? (
        <div className="h-9 rounded-md" style={{ backgroundColor: "var(--chart-grid)" }} />
      ) : (
        <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-md">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-center"
                style={{ flexGrow: s.value, flexBasis: 0, minWidth: 20, backgroundColor: s.color }}
                title={`${s.label}: ${s.value}`}
              >
                <span
                  className="font-mono-nums text-xs font-bold"
                  style={{ color: "var(--seg-ink, var(--bg))", mixBlendMode: "difference" }}
                >
                  {s.value}
                </span>
              </div>
            ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
            <span className="font-mono-nums font-medium text-fg">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
