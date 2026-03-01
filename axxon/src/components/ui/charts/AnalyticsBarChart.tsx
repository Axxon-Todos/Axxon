'use client'

type AnalyticsBarChartItem = {
  id: string | number;
  label: string;
  value: number;
  color: string;
  secondaryValue?: number;
  meta?: string;
};

type AnalyticsBarChartProps = {
  items: AnalyticsBarChartItem[];
  maxValue?: number;
  emptyLabel: string;
};

export default function AnalyticsBarChart({
  items,
  maxValue,
  emptyLabel,
}: AnalyticsBarChartProps) {
  if (!items.length) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.35rem] p-6 text-sm app-text-muted">
        {emptyLabel}
      </div>
    );
  }

  const computedMax = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="flex h-full flex-col gap-3">
      {items.map((item) => {
        const width = `${Math.max((item.value / computedMax) * 100, item.value > 0 ? 8 : 0)}%`;

        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-xs font-semibold app-text-muted">
                {item.value}
                {typeof item.secondaryValue === 'number' ? ` / ${item.secondaryValue}` : ''}
              </span>
            </div>
            <div className="glass-panel overflow-hidden rounded-full p-1">
              <div
                className="h-3 rounded-full"
                style={{
                  width,
                  background: `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color} 65%, white 35%))`,
                }}
                title={item.meta}
              />
            </div>
            {item.meta ? <p className="text-xs app-text-muted">{item.meta}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
