// Verifies the label treemap tolerates partial Recharts node payloads without crashing the analytics page.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  Treemap: ({
    children,
    content,
  }: {
    children?: React.ReactNode;
    content?: (props: unknown) => React.ReactNode;
  }) => (
    <div data-testid="label-treemap">
      {content?.({
        depth: 1,
        height: 96,
        name: 'Missing payload',
        value: 2,
        width: 140,
        x: 0,
        y: 0,
      })}
      {content?.({
        depth: 1,
        height: 120,
        name: 'Backend',
        payload: {
          active: 1,
          color: '#3b82f6',
          completed: 3,
          completionRate: 75,
          id: 41,
          name: 'Backend',
          total: 4,
          value: 4,
        },
        value: 4,
        width: 180,
        x: 12,
        y: 12,
      })}
      {children}
    </div>
  ),
}));

import AnalyticsLabelTreemap from '@/components/features/boardAnalytics/AnalyticsLabelTreemap';

describe('AnalyticsLabelTreemap', () => {
  it('renders safely when Recharts omits node payload data', () => {
    render(
      <AnalyticsLabelTreemap
        emptyLabel="No label activity yet for this filter."
        items={[
          {
            active: 1,
            color: '#3b82f6',
            completed: 3,
            completionRate: 75,
            id: 41,
            name: 'Backend',
            total: 4,
            value: 4,
          },
        ]}
        scope="all"
      />
    );

    expect(screen.getByTestId('label-treemap')).toBeInTheDocument();
    expect(screen.getByText('Dominant signal')).toBeInTheDocument();
    expect(screen.getAllByText('Backend').length).toBeGreaterThan(0);
  });
});
