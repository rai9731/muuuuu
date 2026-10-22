import type { ReactNode } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import { GlassCard } from '@components/ui/Display';
import { formatCurrency } from '@utils/format';

/** Cores dos gráficos, alinhadas à paleta rural. */
export const CHART_COLORS = ['#2f5d3a', '#d9a441', '#8b5e3c', '#4f8a4b', '#b9862a', '#6b9e68', '#a47148'];

const AXIS = { fontSize: 12, tickLine: false, axisLine: false, stroke: 'rgb(43 43 43 / 0.55)' } as const;

export function ChartCard({ title, subtitle, action, className = '', children }: { title: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <GlassCard className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-grafite">{title}</h2>
          {subtitle && <p className="text-xs text-grafite/60">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </GlassCard>
  );
}

export function NoData({ children = 'Sem dados no período.' }: { children?: ReactNode }) {
  return <p className="flex h-48 items-center justify-center text-sm text-grafite/60">{children}</p>;
}

function GlassTooltip({ active, payload, label, money }: TooltipProps<number, string> & { money?: string[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      {label && <p className="mb-1 font-semibold text-grafite">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey as string} className="flex items-center gap-2 text-grafite/80">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <strong>{money?.includes(p.dataKey as string) ? formatCurrency(Number(p.value)) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

interface TrendProps {
  data: Record<string, string | number>[];
  /** Série principal (área, em R$) e secundária (linha). */
  area: { key: string; name: string };
  line?: { key: string; name: string; money?: boolean };
  height?: number;
}

/** Área com degradê + linha opcional em eixo secundário. */
export function TrendChart({ data, area, line, height = 288 }: TrendProps) {
  const money = [area.key, ...(line?.money ? [line.key] : [])];
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4f8a4b" stopOpacity="0.55" />
              <stop offset="1" stopColor="#4f8a4b" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(47 93 58 / 0.12)" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis yAxisId="l" {...AXIS} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
          {line && !line.money && <YAxis yAxisId="r" orientation="right" allowDecimals={false} {...AXIS} />}
          <Tooltip content={<GlassTooltip money={money} />} />
          <Area yAxisId="l" type="monotone" dataKey={area.key} name={area.name} stroke="#2f5d3a" strokeWidth={2.5} fill="url(#trendFill)" />
          {line && (
            <Line yAxisId={line.money ? 'l' : 'r'} type="monotone" dataKey={line.key} name={line.name} stroke="#d9a441" strokeWidth={2.5} dot={{ r: 3, fill: '#d9a441', strokeWidth: 0 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rosca com legenda lateral; `valueKey` define a fatia. */
export function DonutChart({ data, nameKey, valueKey, centerLabel }: { data: Record<string, string | number>[]; nameKey: string; valueKey: string; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + Number(d[valueKey]), 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<GlassTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-grafite">{total}</span>
          {centerLabel && <span className="text-[11px] text-grafite/60">{centerLabel}</span>}
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={String(d[nameKey])} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{d[nameKey]}</span>
            <span className="font-semibold">{d[valueKey]}</span>
            <span className="w-10 text-right text-xs text-grafite/55">{total ? Math.round((Number(d[valueKey]) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais (ex.: vendas por estado). */
export function RankBars({ data, nameKey, valueKey, name, money, height }: { data: Record<string, string | number>[]; nameKey: string; valueKey: string; name: string; money?: boolean; height?: number }) {
  return (
    <div style={{ height: height ?? Math.max(180, data.length * 38) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={nameKey} width={44} {...AXIS} />
          <Tooltip cursor={{ fill: 'rgb(47 93 58 / 0.06)' }} content={<GlassTooltip money={money ? [valueKey] : []} />} />
          <Bar dataKey={valueKey} name={name} radius={[0, 8, 8, 0]} barSize={18}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras agrupadas verticais (ex.: receita × comissões). */
export function GroupedBars({ data, series, height = 288 }: { data: Record<string, string | number>[]; series: { key: string; name: string; color: string }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(47 93 58 / 0.12)" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
          <Tooltip cursor={{ fill: 'rgb(47 93 58 / 0.06)' }} content={<GlassTooltip money={series.map((s) => s.key)} />} />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[8, 8, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
