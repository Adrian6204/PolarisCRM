/**
 * "A closer look" — compact, static previews of three more surfaces (calendar,
 * analytics, automations), built from divs in the app's real tokens so they
 * mirror the actual UI without screenshots that drift.
 */

function ScreenFrame({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="ml-2 text-[11px] text-muted">{title}</span>
      </div>
      <div className="flex-1 p-4">{children}</div>
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm text-muted">{caption}</p>
      </div>
    </div>
  );
}

function CalendarMini() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  // Which day cells carry a stub appointment block.
  const blocks: Record<number, number> = { 1: 2, 3: 1, 4: 2 };
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className={`rounded-sm py-1 text-center text-[10px] ${i === 3 ? "bg-surface2 font-medium text-fg" : "text-muted"}`}>{d}</div>
          <div className="flex min-h-14 flex-col gap-1 rounded-md bg-surface p-1">
            {Array.from({ length: blocks[i] ?? 0 }).map((_, k) => (
              <div key={k} className="rounded-sm border border-line bg-bg px-1 py-1">
                <div className="h-1 w-3/4 rounded-full bg-line-strong" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsMini() {
  const bars = [42, 68, 54, 88, 60];
  const fills = ["var(--chart-c1)", "var(--chart-c2)", "var(--chart-c3)", "var(--chart-c4)", "var(--chart-c5)"];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono-nums text-2xl font-semibold tabular-nums">61%</span>
        <span className="text-[11px] text-muted">win rate · last 90d</span>
      </div>
      <div className="flex h-20 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: fills[i] }} />
        ))}
      </div>
    </div>
  );
}

function AutomationMini() {
  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <span className="w-fit rounded-full border border-line-strong px-2 py-0.5 font-medium text-muted">When a deal is won</span>
      <div className="ml-2 border-l border-line pl-3">
        <div className="flex flex-col gap-1.5">
          <div className="rounded-md border border-line bg-surface px-2 py-1.5">Add tag <span className="font-medium text-fg">&ldquo;Customer&rdquo;</span></div>
          <div className="rounded-md border border-line bg-surface px-2 py-1.5">Log activity &amp; <span className="font-medium text-fg">notify admins</span></div>
        </div>
      </div>
    </div>
  );
}

export function CloserLook() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-stagger>
      <ScreenFrame title="Calendar" caption="Book appointments against real availability.">
        <CalendarMini />
      </ScreenFrame>
      <ScreenFrame title="Analytics" caption="Win rate, cycle time, and a sales leaderboard.">
        <AnalyticsMini />
      </ScreenFrame>
      <ScreenFrame title="Automations" caption="Trigger → action rules that run themselves.">
        <AutomationMini />
      </ScreenFrame>
    </div>
  );
}
