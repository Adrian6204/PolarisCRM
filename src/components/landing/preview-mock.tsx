import { formatMoney } from "@/features/deals/display";

/**
 * A stylized, static preview of the app for the landing hero — built from divs
 * (no screenshot to drift out of date), in the same monochrome language as the
 * real UI: KPI tiles + a mini pipeline board inside a browser-chrome frame.
 */
const KPIS = [
  { label: "Active clients", value: "24" },
  { label: "Open pipeline", value: formatMoney(182000) },
  { label: "Win rate", value: "61%" },
];

const COLUMNS = [
  { name: "Lead", deals: [{ t: "Acme — retainer", v: 12000 }, { t: "Northwind expansion", v: 20000 }] },
  { name: "Proposal", deals: [{ t: "Helios rebrand", v: 8500 }] },
  { name: "Won", deals: [{ t: "Vertex app", v: 42000 }] },
];

export function PreviewMock() {
  return (
    <div className="animate-rise overflow-hidden rounded-xl border border-line-strong bg-bg shadow-md">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 rounded bg-surface2 px-2 py-0.5 text-xs text-muted">polaris.dev/dashboard</span>
      </div>

      <div className="flex">
        {/* Mini sidebar (desktop only) */}
        <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-line p-3 sm:flex">
          {["Dashboard", "Clients", "Projects", "Pipeline", "Calendar", "Analytics"].map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${i === 0 ? "bg-surface2 font-medium text-fg" : "text-muted"}`}
            >
              <span className="h-3 w-3 rounded-sm bg-line-strong" />
              {item}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 p-4 sm:p-5">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="card p-3">
                <div className="font-mono-nums text-lg font-semibold tabular-nums sm:text-2xl">{k.value}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {COLUMNS.map((col) => (
              <div key={col.name} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-0.5">
                  <span className="text-xs font-semibold">{col.name}</span>
                  <span className="font-mono-nums text-[10px] text-muted">{col.deals.length}</span>
                </div>
                <div className="flex min-h-16 flex-col gap-2 rounded-lg bg-surface p-1.5">
                  {col.deals.map((d) => (
                    <div key={d.t} className="rounded-md border border-line bg-bg p-2 shadow-sm">
                      <div className="truncate text-[11px] font-medium">{d.t}</div>
                      <div className="mt-1 font-mono-nums text-[11px] tabular-nums text-muted">{formatMoney(d.v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
