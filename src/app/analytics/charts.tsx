"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/features/deals/display";

/** Shared datum: a labelled magnitude, optional per-bar colour override. */
export interface Datum {
  label: string;
  value: number;
  fill?: string;
}

/** Formatter is chosen by a serializable name (functions can't cross the
 *  server→client boundary). */
export type ValueFormat = "number" | "money";
const FORMATTERS: Record<ValueFormat, (n: number) => string> = {
  number: (n) => String(n),
  money: formatMoney,
};

const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 } as const;
const MONO = "var(--font-mono), ui-monospace, monospace";

/** Card-styled tooltip — nothing that reads as default Recharts chrome. */
function ChartTooltip({
  active,
  payload,
  label,
  format,
  unitLabel,
}: {
  active?: boolean;
  payload?: readonly { value?: number | string }[];
  label?: React.ReactNode;
  format: (n: number) => string;
  unitLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="card px-3 py-2 shadow-md">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="font-mono-nums text-sm font-semibold">
        {format(value)}
        <span className="ml-1 font-sans text-xs font-normal text-muted">{unitLabel}</span>
      </div>
    </div>
  );
}

const labelFmt = (fmt: (n: number) => string) => (v: React.ReactNode) =>
  fmt(Number(v ?? 0));

/**
 * Vertical magnitude bars — one ink colour (identity is on the axis, so colour
 * is not doing identity work), thin marks, 4px rounded data-ends, direct value
 * labels (mandatory relief for the light ramp steps), recessive horizontal grid.
 */
export function MagnitudeBars({
  data,
  format = "number",
  unitLabel = "",
  height = 240,
}: {
  data: Datum[];
  format?: ValueFormat;
  unitLabel?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: 4, bottom: 4 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={4} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }}
            content={(p) => <ChartTooltip active={(p as {active?:boolean}).active} payload={(p as {payload?:readonly {value?:number|string}[]}).payload} label={(p as {label?:React.ReactNode}).label} format={FORMATTERS[format]} unitLabel={unitLabel} />}
          />
          <Bar dataKey="value" fill="var(--chart-ink)" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill ?? "var(--chart-ink)"} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={labelFmt(FORMATTERS[format])}
              style={{ fill: "var(--fg)", fontSize: 11, fontWeight: 700, fontFamily: MONO }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Horizontal category bars — for ranking a dimension (service lines, owners).
 * Category labels on the y-axis, value labels at each bar end.
 */
export function CategoryBars({
  data,
  format = "number",
  unitLabel = "",
  height = 240,
}: {
  data: Datum[];
  format?: ValueFormat;
  unitLabel?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
          barCategoryGap="28%"
        >
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={116}
            tick={AXIS_TICK}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }}
            content={(p) => <ChartTooltip active={(p as {active?:boolean}).active} payload={(p as {payload?:readonly {value?:number|string}[]}).payload} label={(p as {label?:React.ReactNode}).label} format={FORMATTERS[format]} unitLabel={unitLabel} />}
          />
          <Bar dataKey="value" fill="var(--chart-ink)" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill ?? "var(--chart-ink)"} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={labelFmt(FORMATTERS[format])}
              style={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700, fontFamily: MONO }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
