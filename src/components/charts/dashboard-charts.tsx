"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  name: string;
  value: number;
}

const PALETTE = ["#0f766e", "#0284c7", "#d97706", "#e11d48", "#7c3aed", "#0f766e", "#0891b2", "#65a30d", "#334155", "#c026d3"];

function humanize(value: string) {
  const text = value.replaceAll("_", " ").trim();
  if (!text) return "Unassigned";
  if (/^\d{4}/.test(text)) return text;
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("en-IN");
}

export function toChart(
  map?: Record<string, number> | readonly unknown[] | null,
  options?: Array<{ label: string; value: string }>
): ChartPoint[] {
  if (!map || Array.isArray(map)) return [];
  return Object.entries(map || {}).map(([name, value]) => ({
    name: options?.find((option) => option.value === name)?.label || humanize(name || "Unassigned"),
    value: Number(value || 0),
  }));
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 h-72">{children}</div>
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { name?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const title = label || payload[0]?.payload?.name || payload[0]?.name || "";
  return (
    <div className="rounded-xl border border-border/80 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{title}</p>
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: item.color || PALETTE[0] }} />
          <span className="tabular-nums text-foreground">{formatNumber(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function isTimeSeries(data: ChartPoint[]) {
  return data.length > 0 && data.every((point) => /^\d{4}/.test(point.name));
}

export function BarBlock({ data, empty = "No records in this view yet." }: { data: ChartPoint[]; empty?: string }) {
  const points = data.filter((point) => Number.isFinite(point.value));
  if (!points.length) return <EmptyChart label={empty} />;
  if (isTimeSeries(points)) return <TrendBars data={points} />;
  const ranked = [...points].sort((left, right) => right.value - left.value).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 16)}…` : value)}
        />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(15,118,110,0.08)" }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16} name="Count">
          {ranked.map((point, index) => (
            <Cell key={point.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendBars({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.35)" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={40} tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(15,118,110,0.08)" }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={42} name="Value">
          {data.map((point, index) => (
            <Cell key={point.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieBlock({ data, empty = "No records in this view yet." }: { data: ChartPoint[]; empty?: string }) {
  const points = data.filter((point) => point.value > 0);
  if (!points.length) return <EmptyChart label={empty} />;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return (
    <div className="grid h-full grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.85fr)]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={points} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} cornerRadius={6} stroke="none">
            {points.map((point, index) => (
              <Cell key={point.name} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="max-h-full space-y-2 overflow-auto pr-1">
        {points.map((point, index) => (
          <li key={point.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
              <span className="truncate text-muted-foreground">{point.name}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatNumber(point.value)}
              <span className="ml-1 font-normal text-muted-foreground">{total ? `${Math.round((point.value / total) * 100)}%` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlowChart({
  data,
  empty = "No cash movement in this period.",
}: {
  data: Array<{ name: string; inflow: number; outflow: number }>;
  empty?: string;
}) {
  if (!data.length) return <EmptyChart label={empty} />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.35)" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(15,118,110,0.08)" }} />
        <Bar dataKey="inflow" name="In" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={22} />
        <Bar dataKey="outflow" name="Out" fill="#e11d48" radius={[8, 8, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
