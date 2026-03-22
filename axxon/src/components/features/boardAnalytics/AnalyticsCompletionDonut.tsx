'use client'

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

function buildDonutGradient(items: AnalyticsCompletionItem[], total: number) {
  let currentStop = 0;

  return items
    .map((item) => {
      const start = currentStop;
      currentStop += (item.value / total) * 100;
      return `${item.color} ${start}% ${currentStop}%`;
    })
    .join(', ');
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

  const donutBackground = `conic-gradient(${buildDonutGradient(visibleItems, total)})`;

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="relative flex min-h-[220px] items-center justify-center">
        <div
          className="relative aspect-square w-full max-w-[260px] rounded-full"
          style={{ background: donutBackground }}
          aria-label="Completion breakdown chart"
        >
          <div className="absolute inset-[18%] rounded-full bg-[var(--app-panel-strong)]" />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] app-text-muted">
                {centerLabel}
              </p>
            ) : null}
            {centerValue ? <p className="mt-1 text-2xl font-semibold">{centerValue}</p> : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2.5">
        {visibleItems.map((item) => {
          const percentage = Math.round((item.value / total) * 100);

          return (
            <article
              key={item.id}
              className="glass-panel rounded-[1rem] px-3 py-2.5"
              title={`${item.label}: ${item.value} todos`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <p className="truncate text-sm font-medium">{item.label}</p>
                </div>
                <span className="text-xs font-semibold app-text-muted">
                  {item.value}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_78%,transparent)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <p className="mt-1 text-xs app-text-muted">{percentage}% of tracked todos</p>
              {item.description ? <p className="mt-1 text-xs app-text-muted">{item.description}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
