'use client'

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

  const maxValue = Math.max(...items.map((item) => getValueForScope(item, scope)), 1);

  return (
    <div className="flex h-full min-h-[260px] flex-col gap-3">
      {scope === 'all' ? (
        <div className="flex flex-wrap gap-2 text-xs app-text-muted">
          <span className="app-badge">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--app-accent)' }} />
            Completed
          </span>
          <span className="app-badge">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            Active
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const value = getValueForScope(item, scope);
          const width = `${Math.max((value / maxValue) * 100, value > 0 ? 8 : 0)}%`;
          const completedWidth = item.total > 0 ? `${(item.completed / item.total) * 100}%` : '0%';
          const activeWidth = item.total > 0 ? `${(item.active / item.total) * 100}%` : '0%';

          return (
            <article
              key={item.id}
              className="glass-panel rounded-[1.2rem] px-3 py-3"
              title={`${item.label}: ${item.total} total, ${item.completed} completed, ${item.active} active`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <p className="truncate text-sm font-medium">{item.label}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold app-text-muted">
                  {value}
                </span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_78%,transparent)]">
                {scope === 'all' ? (
                  <div className="flex h-full overflow-hidden rounded-full" style={{ width }}>
                    <span style={{ width: completedWidth, backgroundColor: item.color }} />
                    <span style={{ width: activeWidth, backgroundColor: '#94a3b8' }} />
                  </div>
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width,
                      backgroundColor: scope === 'active' ? '#94a3b8' : item.color,
                    }}
                  />
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs app-text-muted">
                <span>{item.total} total</span>
                <span>{item.completed} completed</span>
                <span>{item.active} active</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
