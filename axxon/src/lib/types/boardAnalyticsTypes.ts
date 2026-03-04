export type AnalyticsCategoryMetric = {
  category_id: number;
  name: string;
  color: string;
  position: number;
  is_done: boolean;
  total_todos: number;
  completed_todos: number;
  active_todos: number;
  completion_rate: number;
};

export type AnalyticsMemberCategoryMetric = {
  category_id: number;
  total_todos: number;
  completed_todos: number;
};

export type AnalyticsMemberMetric = {
  user_id: number;
  first_name: string;
  last_name: string;
  avatar_url: string;
  assigned_total_todos: number;
  assigned_completed_todos: number;
  assigned_active_todos: number;
  completion_rate: number;
  by_category: AnalyticsMemberCategoryMetric[];
};

export type AnalyticsLabelCategoryMetric = {
  category_id: number;
  total_todos: number;
  completed_todos: number;
};

export type AnalyticsLabelMetric = {
  label_id: number;
  name: string;
  color: string;
  total_todos: number;
  completed_todos: number;
  active_todos: number;
  completion_rate: number;
  by_category: AnalyticsLabelCategoryMetric[];
};

export type BoardAnalyticsSummary = {
  total_todos: number;
  completed_todos: number;
  active_todos: number;
  unassigned_todos: number;
  completion_rate: number;
  category_count: number;
  completed_category_count: number;
  active_category_count: number;
};

export type BoardAnalyticsData = {
  board: {
    id: number;
    name: string;
    color?: string;
  };
  generated_at: string;
  summary: BoardAnalyticsSummary;
  categories: AnalyticsCategoryMetric[];
  members: AnalyticsMemberMetric[];
  labels: AnalyticsLabelMetric[];
};
