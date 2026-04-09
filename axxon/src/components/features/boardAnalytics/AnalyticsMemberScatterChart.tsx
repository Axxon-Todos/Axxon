// Maps member workload against completion so the analytics page can spotlight throughput balance.
'use client';

import { useReducedMotion } from 'framer-motion';
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import AnalyticsEmptyState from './AnalyticsEmptyState';

type ScopeMode = 'all' | 'completed' | 'active';

export type AnalyticsMemberScatterItem = {
  id: number | string;
  name: string;
  initials: string;
  completionRate: number;
  total: number;
  completed: number;
  active: number;
  scopeValue: number;
  color?: string;
};

type AnalyticsMemberScatterChartProps = {
  items: AnalyticsMemberScatterItem[];
  scope: ScopeMode;
  benchmarkCompletionRate: number;
  emptyLabel: string;
};

function scopeLabel(scope: ScopeMode) {
  if (scope === 'completed') return 'Completed';
  if (scope === 'active') return 'Active';
  return 'Tracked';
}

function MemberTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AnalyticsMemberScatterItem }>;
}) {
  const member = payload?.[0]?.payload;

  if (!active || !member) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-3 py-2.5 shadow-[0_22px_60px_-30px_rgba(2,6,23,0.9)]">
      <p className="text-sm font-semibold">{member.name}</p>
      <p className="mt-1 text-xs app-text-muted">{member.completionRate}% completion rate</p>
      <div className="mt-2 grid gap-1.5 text-xs app-text-muted">
        <p>{member.total} assigned total</p>
        <p>{member.completed} completed</p>
        <p>{member.active} active</p>
      </div>
    </div>
  );
}

export default function AnalyticsMemberScatterChart({
  items,
  scope,
  benchmarkCompletionRate,
  emptyLabel,
}: AnalyticsMemberScatterChartProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const visibleItems = items.filter((item) => item.scopeValue > 0 || item.total > 0);

  if (!visibleItems.length) {
    return <AnalyticsEmptyState label={emptyLabel} className="min-h-[320px]" />;
  }

  const chartHeight = Math.max(320, visibleItems.length * 56);
  const scopeName = scopeLabel(scope);
  const topScopeValue = Math.max(...visibleItems.map((item) => item.scopeValue), 1);
  const averageScopeValue = Math.round(
    visibleItems.reduce((sum, item) => sum + item.scopeValue, 0) / visibleItems.length
  );

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-3 py-3">
        <ResponsiveContainer width="100%" height={chartHeight} minWidth={260}>
          <ScatterChart margin={{ top: 20, right: 18, bottom: 6, left: 2 }}>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--app-border) 80%, transparent)"
              strokeDasharray="4 8"
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="completionRate"
              domain={[0, 100]}
              tickCount={6}
              tickLine={false}
              axisLine={false}
              unit="%"
              tick={{ fill: 'var(--app-muted)', fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="scopeValue"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fill: 'var(--app-muted)', fontSize: 12 }}
            />
            <ZAxis type="number" dataKey="total" range={[160, 860]} />
            {benchmarkCompletionRate > 0 ? (
              <ReferenceLine
                x={benchmarkCompletionRate}
                stroke="var(--analytics-accent, var(--app-accent))"
                strokeDasharray="5 6"
                strokeOpacity={0.85}
              />
            ) : null}
            <Tooltip
              cursor={{
                stroke: 'color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 42%, transparent)',
                strokeWidth: 1.5,
              }}
              content={<MemberTooltip />}
            />
            <Scatter data={visibleItems} isAnimationActive={!shouldReduceMotion}>
              {visibleItems.map((item) => (
                <Cell
                  key={item.id}
                  fill={item.color || 'var(--analytics-accent, var(--app-accent))'}
                  fillOpacity={0.88}
                  stroke="color-mix(in srgb, white 28%, transparent)"
                  strokeOpacity={0.72}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <article className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">Benchmark</p>
          <p className="mt-2 text-lg font-semibold">{benchmarkCompletionRate}% completion</p>
          <p className="mt-1 text-xs leading-5 app-text-muted">Vertical guide for the current board or selected category.</p>
        </article>
        <article className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">Top {scopeName}</p>
          <p className="mt-2 text-lg font-semibold">{topScopeValue} todos</p>
          <p className="mt-1 text-xs leading-5 app-text-muted">Largest visible workload in this contributor map.</p>
        </article>
        <article className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">Average {scopeName}</p>
          <p className="mt-2 text-lg font-semibold">{averageScopeValue} todos</p>
          <p className="mt-1 text-xs leading-5 app-text-muted">Helps separate outlier contributors from the middle of the pack.</p>
        </article>
      </div>
    </div>
  );
}
