'use client'

type ChartTooltipProps = {
  title: string;
  description?: string;
  value?: string;
};

//shoiws chart info
export default function ChartTooltip({ title, description, value }: ChartTooltipProps) {
  return (
    <div className="glass-panel rounded-[1.1rem] p-3">
      <p className="text-sm font-semibold">{title}</p>
      {value ? <p className="mt-1 text-xs font-medium app-text-muted">{value}</p> : null}
      {description ? <p className="mt-2 text-xs leading-5 app-text-muted">{description}</p> : null}
    </div>
  );
}
