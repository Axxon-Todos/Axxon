// Renders a completion ring with companion segment details for the executive analytics overview.
'use client';

import AnalyticsEmptyState from './AnalyticsEmptyState';

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
    return <AnalyticsEmptyState label={emptyLabel} />;
  }

  const donutBackground = `conic-gradient(${buildDonutGradient(visibleItems, total)})`;

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
      <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-[1.45rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-6">
        <div
          className="absolute inset-x-8 top-0 h-24 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--analytics-accent, var(--app-accent)) 18%, transparent), transparent 72%)',
          }}
        />
        <div
          className="relative aspect-square w-full max-w-[300px] rounded-full shadow-[0_30px_90px_-44px_rgba(2,6,23,0.88)]"
          style={{ background: donutBackground }}
          aria-label="Completion breakdown chart"
        >
          <div className="absolute inset-[14%] rounded-full border border-[var(--app-border)] bg-[var(--app-panel-strong)]" />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel ? (
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] app-text-muted">
                {centerLabel}
              </p>
            ) : null}
            {centerValue ? <p className="mt-2 text-4xl font-semibold tracking-tight">{centerValue}</p> : null}
            <p className="mt-2 max-w-[11rem] text-xs leading-5 app-text-muted">
              Completion only counts work that is both marked complete and placed in a done workflow stage.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        {visibleItems.map((item) => {
          const percentage = Math.round((item.value / total) * 100);

          return (
            <article
              key={item.id}
              className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_82%,transparent)] px-4 py-3.5"
              title={`${item.label}: ${item.value} todos`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                  </div>
                  {item.description ? (
                    <p className="mt-2 text-xs leading-5 app-text-muted">{item.description}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold">{item.value}</p>
                  <p className="text-xs app-text-muted">{percentage}%</p>
                </div>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--app-border)_78%,transparent)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
