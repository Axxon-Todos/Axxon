'use client'

import { useMemo, useState } from 'react';
import ChartTooltip from './ChartTooltip';

type AnalyticsDonutChartItem = {
  id: string | number;
  label: string;
  value: number;
  color: string;
  description?: string;
};

type AnalyticsDonutChartProps = {
  items: AnalyticsDonutChartItem[];
  centerLabel?: string;
  centerValue?: string;
  emptyLabel: string;
  innerRadius?: number;
};

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

export default function AnalyticsDonutChart({
  items,
  centerLabel,
  centerValue,
  emptyLabel,
  innerRadius = 44,
}: AnalyticsDonutChartProps) {
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  if (!items.length || total === 0) {
    return (
      <div className="glass-panel flex h-full items-center justify-center rounded-[1.35rem] p-6 text-sm app-text-muted">
        {emptyLabel}
      </div>
    );
  }

  let startAngle = 0;

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
      <div className="relative mx-auto aspect-square w-full max-w-[260px]">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          {items.map((item) => {
            const angle = (item.value / total) * 360;
            const endAngle = startAngle + angle;
            const isActive = activeId === item.id;
            const path = describeArc(60, 60, isActive ? 56 : 54, innerRadius, startAngle, endAngle);
            const segment = (
              <path
                key={item.id}
                d={path}
                fill={item.color}
                opacity={isActive || activeId === null ? 1 : 0.72}
                onMouseEnter={() => setActiveId(item.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <title>{`${item.label}: ${item.value}`}</title>
              </path>
            );
            startAngle = endAngle;
            return segment;
          })}
          <circle cx="60" cy="60" r={innerRadius - 4} fill="color-mix(in srgb, var(--app-panel-strong) 95%, white 5%)" />
          <text x="60" y="53" textAnchor="middle" className="fill-current text-[6px] font-semibold app-text-muted">
            {centerLabel}
          </text>
          <text x="60" y="67" textAnchor="middle" className="fill-current text-[12px] font-semibold">
            {centerValue}
          </text>
        </svg>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => setActiveId(item.id)}
            onMouseLeave={() => setActiveId(null)}
            className="text-left"
          >
            <ChartTooltip
              title={item.label}
              value={`${item.value} items`}
              description={item.description}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
