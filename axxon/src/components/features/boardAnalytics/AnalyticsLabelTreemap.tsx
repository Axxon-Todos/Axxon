// Visualizes label concentration as a treemap so dominant tag clusters read at a glance.
'use client';

import { useReducedMotion } from 'framer-motion';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';

import AnalyticsEmptyState from './AnalyticsEmptyState';

type ScopeMode = 'all' | 'completed' | 'active';

export type AnalyticsLabelTreemapItem = {
  id: number | string;
  name: string;
  value: number;
  total: number;
  completed: number;
  active: number;
  completionRate: number;
  color: string;
};

type AnalyticsLabelTreemapProps = {
  items: AnalyticsLabelTreemapItem[];
  scope: ScopeMode;
  emptyLabel: string;
};

type TreemapNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  depth?: number;
  payload?: Partial<AnalyticsLabelTreemapItem>;
};

function scopeLabel(scope: ScopeMode) {
  if (scope === 'completed') return 'completed';
  if (scope === 'active') return 'active';
  return 'tracked';
}

function TreemapNode({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  value = 0,
  depth = 0,
  payload,
}: TreemapNodeProps) {
  if (depth !== 1 || width <= 0 || height <= 0) {
    return null;
  }

  const nodeName = payload?.name || name || 'Unlabeled';
  const nodeValue = typeof value === 'number' ? value : (payload?.value ?? 0);
  const nodeColor = payload?.color || 'var(--analytics-accent, var(--app-accent))';
  const completionRate =
    typeof payload?.completionRate === 'number' ? payload.completionRate : 0;
  const compact = width < 110 || height < 70;
  const label =
    nodeName.length > 16 && compact ? `${nodeName.slice(0, 13)}...` : nodeName;

  return (
    <g>
      <rect
        x={x + 4}
        y={y + 4}
        width={Math.max(width - 8, 0)}
        height={Math.max(height - 8, 0)}
        rx={18}
        ry={18}
        fill={nodeColor}
        fillOpacity={0.88}
        stroke="color-mix(in srgb, white 24%, transparent)"
        strokeOpacity={0.22}
      />
      {!compact ? (
        <>
          <text x={x + 18} y={y + 28} fill="#f8fafc" fontSize="12" fontWeight="700">
            {label}
          </text>
          <text x={x + 18} y={y + 48} fill="rgba(248, 250, 252, 0.88)" fontSize="17" fontWeight="700">
            {nodeValue}
          </text>
          <text x={x + 18} y={y + 66} fill="rgba(248, 250, 252, 0.78)" fontSize="11">
            {completionRate}% completion
          </text>
        </>
      ) : width > 78 && height > 44 ? (
        <text x={x + 14} y={y + 26} fill="#f8fafc" fontSize="12" fontWeight="700">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function renderTreemapNode(props: unknown) {
  if (!props || typeof props !== 'object') {
    return <></>;
  }

  return <TreemapNode {...(props as TreemapNodeProps)} />;
}

function LabelTooltip({
  active,
  payload,
  scope,
}: {
  active?: boolean;
  payload?: Array<{ payload: AnalyticsLabelTreemapItem }>;
  scope: ScopeMode;
}) {
  const label = payload?.[0]?.payload;

  if (!active || !label) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-3 py-2.5 shadow-[0_22px_60px_-30px_rgba(2,6,23,0.9)]">
      <p className="text-sm font-semibold">{label.name}</p>
      <p className="mt-1 text-xs app-text-muted">
        {label.value} {scopeLabel(scope)} todos
      </p>
      <div className="mt-2 grid gap-1.5 text-xs app-text-muted">
        <p>{label.total} total</p>
        <p>{label.completed} completed</p>
        <p>{label.active} active</p>
      </div>
    </div>
  );
}

export default function AnalyticsLabelTreemap({
  items,
  scope,
  emptyLabel,
}: AnalyticsLabelTreemapProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const visibleItems = items.filter((item) => item.value > 0);

  if (!visibleItems.length) {
    return <AnalyticsEmptyState label={emptyLabel} className="min-h-[320px]" />;
  }

  const dominantLabel = visibleItems[0];

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="rounded-[1.35rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-3 py-3">
        <ResponsiveContainer width="100%" height={340} minWidth={260}>
          <Treemap
            data={visibleItems}
            dataKey="value"
            isAnimationActive={!shouldReduceMotion}
            stroke="transparent"
            content={renderTreemapNode}
            aspectRatio={1.8}
          >
            <Tooltip content={<LabelTooltip scope={scope} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <article className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">Dominant signal</p>
          <p className="mt-2 text-lg font-semibold">{dominantLabel.name}</p>
          <p className="mt-1 text-xs leading-5 app-text-muted">
            Largest visible label cluster with {dominantLabel.value} {scopeLabel(scope)} todos.
          </p>
        </article>
        <article className="rounded-[1.2rem] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-soft)_72%,transparent)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] app-text-muted">Visible labels</p>
          <p className="mt-2 text-lg font-semibold">{visibleItems.length}</p>
          <p className="mt-1 text-xs leading-5 app-text-muted">Treemap tiles are weighted by the current scope so dormant tags fall away.</p>
        </article>
      </div>
    </div>
  );
}
