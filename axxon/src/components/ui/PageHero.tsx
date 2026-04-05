// Provides a shared top-of-page hero pattern for dashboard, organization, board, analytics, and settings views.
import type { CSSProperties, ReactNode } from 'react';

export default function PageHero({
  kicker,
  title,
  description,
  accentColor,
  actions,
  badges,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  accentColor?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className="app-page-hero"
      style={accentColor ? ({ ['--hero-accent' as string]: accentColor } as CSSProperties) : undefined}
    >
      <div className="app-page-hero-content flex flex-col gap-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="app-kicker">{kicker}</p>
            <div className="mt-4 flex items-start gap-3">
              {accentColor ? (
                <span
                  className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 0 8px color-mix(in srgb, ${accentColor} 18%, transparent)`,
                  }}
                />
              ) : null}
              <div className="min-w-0">
                <h1 className="app-page-hero-title">{title}</h1>
                <p className="app-page-hero-description mt-4">{description}</p>
              </div>
            </div>

            {badges ? <div className="mt-6 flex flex-wrap gap-2">{badges}</div> : null}
          </div>

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {children}
      </div>
    </section>
  );
}
