'use client'

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';

type AnalyticsCompletionItem = {
  id: string | number;
  label: string;
  value: number;
  color: string;
  description?: string;
};

type AnalyticsCompletionDonutProps = {
  items: AnalyticsCompletionItem[];
  centerLabel?: string;
  centerValue?: string;
  emptyLabel: string;
};

function DonutTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload as AnalyticsCompletionItem;
  if (!item) return null;

  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{item.label}</p>
      <p className="mt-1 app-text-muted">{item.value} todos</p>
      {item.description ? <p className="mt-1 app-text-muted">{item.description}</p> : null}
    </div>
  );
}

export default function AnalyticsCompletionDonut({
  items,
  centerLabel,
  centerValue,
  emptyLabel,
}: AnalyticsCompletionDonutProps) {
  const visibleItems = items.filter((item) => item.value > 0);
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0);

  if (!visibleItems.length || total === 0) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.3rem] p-6 text-sm app-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="relative min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visibleItems}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="84%"
              paddingAngle={2}
              stroke="none"
            >
              {visibleItems.map((item) => (
                <Cell key={item.id} fill={item.color} />
              ))}
            </Pie>
            <Tooltip cursor={false} content={DonutTooltip} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel ? <p className="text-xs font-semibold uppercase tracking-[0.14em] app-text-muted">{centerLabel}</p> : null}
          {centerValue ? <p className="mt-1 text-2xl font-semibold">{centerValue}</p> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2.5">
        {visibleItems.map((item) => (
          <article key={item.id} className="glass-panel rounded-[1rem] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="truncate text-sm font-medium">{item.label}</p>
              </div>
              <span className="text-xs font-semibold app-text-muted">{item.value}</span>
            </div>
            {item.description ? <p className="mt-1 text-xs app-text-muted">{item.description}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
