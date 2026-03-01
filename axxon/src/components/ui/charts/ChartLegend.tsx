'use client'

type ChartLegendItem = {
  id: string | number;
  label: string;
  color: string;
  value: string;
};

export default function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="glass-panel flex items-center justify-between rounded-[1rem] px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-sm font-medium">{item.label}</span>
          </div>
          <span className="text-xs font-semibold app-text-muted">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
