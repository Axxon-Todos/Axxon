'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

type ScopeMode = 'all' | 'completed' | 'active';

type AnalyticsLabelBarItem = {
  id: number | string;
  label: string;
  color: string;
  total: number;
  completed: number;
  active: number;
  completionRate: number;
};

type AnalyticsLabelBarChartProps = {
  items: AnalyticsLabelBarItem[];
  scope: ScopeMode;
  emptyLabel: string;
};

function LabelTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload as AnalyticsLabelBarItem;
  if (!item) return null;

  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{item.label}</p>
      <p className="mt-1 app-text-muted">{item.total} total</p>
      <p className="app-text-muted">{item.completed} completed</p>
      <p className="app-text-muted">{item.active} active</p>
      <p className="app-text-muted">{item.completionRate}% completion</p>
    </div>
  );
}

export default function AnalyticsLabelBarChart({
  items,
  scope,
  emptyLabel,
}: AnalyticsLabelBarChartProps) {
  const visibleItems = items.filter((item) => {
    if (scope === 'completed') return item.completed > 0;
    if (scope === 'active') return item.active > 0;
    return item.total > 0;
  });

  if (!visibleItems.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.3rem] p-6 text-sm app-text-muted">
        {emptyLabel}
      </div>
    );
  }

  const valueKey = scope === 'completed' ? 'completed' : scope === 'active' ? 'active' : 'total';
  const chartHeight = Math.max(visibleItems.length * 52, 260);

  return (
    <div className="h-full min-h-[260px]">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={visibleItems}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          barCategoryGap={16}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--app-muted)' }} />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--app-foreground)' }}
            width={128}
          />
          <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--app-panel-strong) 78%, transparent)' }} content={LabelTooltip} />
          <Bar dataKey={valueKey} radius={[0, 10, 10, 0]}>
            {visibleItems.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
