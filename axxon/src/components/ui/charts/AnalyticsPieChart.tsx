'use client'

import type { ComponentProps } from 'react';
import AnalyticsDonutChart from './AnalyticsDonutChart';

type AnalyticsPieChartProps = ComponentProps<typeof AnalyticsDonutChart>;

export default function AnalyticsPieChart(props: AnalyticsPieChartProps) {
  return <AnalyticsDonutChart {...props} innerRadius={1} />;
}
