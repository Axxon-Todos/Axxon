// Renders workflow category load as an immersive stacked chart for board analytics.
'use client';

import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import AnalyticsEmptyState from './AnalyticsEmptyState';

type ScopeMode = 'all' | 'completed' | 'active';

type AnalyticsCategoryBarItem = {
  id: number | string;
  label: string;
  color: string;
  total: number;
  completed: number;
  active: number;
};

type AnalyticsCategoryBarChartProps = {
  items: AnalyticsCategoryBarItem[];
  scope: ScopeMode;
  emptyLabel: string;
};

function getValueForScope(item: AnalyticsCategoryBarItem, scope: ScopeMode) {
  if (scope === 'completed') return item.completed;
  if (scope === 'active') return item.active;
  return item.total;
}

function WorkflowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AnalyticsCategoryBarItem }>;
}) {
  const category = payload?.[0]?.payload;

  if (!active || !category) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-3 py-2.5 shadow-[0_22px_60px_-30px_rgba(2,6,23,0.9)]">
      <p className="text-sm font-semibold">{category.label}</p>
      <div className="mt-2 grid gap-1.5 text-xs app-text-muted">
        <p>{category.total} total</p>
        <p>{category.completed} completed</p>
        <p>{category.active} active</p>
      </div>
    </div>
  );
}

export default function AnalyticsCategoryBarChart({
  items,
  scope,
  emptyLabel,
}: AnalyticsCategoryBarChartProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const visibleItems = items.filter((item) => getValueForScope(item, scope) > 0 || scope === 'all');

  if (!visibleItems.length) {
    return <AnalyticsEmptyState label={emptyLabel} className="min-h-[320px]" />;
  }

  const chartHeight = Math.max(320, visibleItems.length * 58);

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="flex flex-wrap gap-2 text-xs app-text-muted">
        {scope === 'all' ? (
          <>
            <span className="app-badge">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-highlight)]" />
              Active
            </span>
            <span className="app-badge">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--analytics-accent,var(--app-accent))]" />
              Completed
            </span>
          </>
        ) : (
          <span className="app-badge">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  scope === 'active'
                    ? 'var(--app-highlight)'
                    : 'var(--analytics-accent, var(--app-accent))',
              }}
            />
            {scope === 'active' ? 'Active' : 'Completed'}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-3 py-3">
        <ResponsiveContainer width="100%" height={chartHeight} minWidth={260}>
          <BarChart
            data={visibleItems}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
            barCategoryGap={18}
          >
            <CartesianGrid
              stroke="color-mix(in srgb, var(--app-border) 76%, transparent)"
              strokeDasharray="4 8"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--app-muted)', fontSize: 12 }}
            />
            <YAxis
              dataKey="label"
              type="category"
              width={92}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--app-muted-strong)', fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} content={<WorkflowTooltip />} />

            {scope === 'all' ? (
              <>
                <Bar
                  dataKey="active"
                  stackId="workflow"
                  radius={[10, 0, 0, 10]}
                  isAnimationActive={!shouldReduceMotion}
                >
                  {visibleItems.map((item) => (
                    <Cell key={`${item.id}-active`} fill="var(--app-highlight)" fillOpacity={0.78} />
                  ))}
                </Bar>
                <Bar dataKey="completed" stackId="workflow" radius={[0, 10, 10, 0]} isAnimationActive={!shouldReduceMotion}>
                  {visibleItems.map((item) => (
                    <Cell key={`${item.id}-completed`} fill={item.color || 'var(--analytics-accent, var(--app-accent))'} fillOpacity={0.92} />
                  ))}
                </Bar>
              </>
            ) : (
              <Bar
                dataKey={scope === 'active' ? 'active' : 'completed'}
                radius={[10, 10, 10, 10]}
                isAnimationActive={!shouldReduceMotion}
              >
                {visibleItems.map((item) => (
                  <Cell
                    key={item.id}
                    fill={
                      scope === 'active'
                        ? 'var(--app-highlight)'
                        : item.color || 'var(--analytics-accent, var(--app-accent))'
                    }
                    fillOpacity={0.9}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
