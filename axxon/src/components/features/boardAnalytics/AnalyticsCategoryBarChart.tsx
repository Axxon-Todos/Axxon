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

function CategoryTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload as AnalyticsCategoryBarItem;
  if (!item) return null;

  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{item.label}</p>
      <p className="mt-1 app-text-muted">{item.total} total</p>
      <p className="app-text-muted">{item.completed} completed</p>
      <p className="app-text-muted">{item.active} active</p>
    </div>
  );
}

export default function AnalyticsCategoryBarChart({
  items,
  scope,
  emptyLabel,
}: AnalyticsCategoryBarChartProps) {
  if (!items.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.3rem] p-6 text-sm app-text-muted">
        {emptyLabel}
      </div>
    );
  }

  const chartHeight = Math.max(items.length * 54, 260);

  return (
    <div className="h-full min-h-[260px]">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={items}
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
            width={120}
          />
          <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--app-panel-strong) 78%, transparent)' }} content={CategoryTooltip} />

          {scope === 'all' ? (
            <>
              <Bar dataKey="completed" stackId="total" radius={[0, 10, 10, 0]}>
                {items.map((item) => (
                  <Cell key={`${item.id}-completed`} fill={item.color} />
                ))}
              </Bar>
              <Bar dataKey="active" stackId="total" fill="#94a3b8" radius={[0, 10, 10, 0]} />
            </>
          ) : null}

          {scope === 'completed' ? (
            <Bar dataKey="completed" radius={[0, 10, 10, 0]}>
              {items.map((item) => (
                <Cell key={`${item.id}-completed-only`} fill={item.color} />
              ))}
            </Bar>
          ) : null}

          {scope === 'active' ? <Bar dataKey="active" fill="#94a3b8" radius={[0, 10, 10, 0]} /> : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
