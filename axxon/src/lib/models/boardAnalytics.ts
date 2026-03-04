import knex from '@/lib/db/db';
import type {
  AnalyticsCategoryMetric,
  AnalyticsLabelMetric,
  AnalyticsMemberMetric,
  BoardAnalyticsData,
  BoardAnalyticsSummary,
} from '@/lib/types/boardAnalyticsTypes';

const COMPLETED_CASE = `
  CASE
    WHEN todos.is_complete = true AND categories.is_done = true THEN 1
    ELSE 0
  END
`;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toRate(completed: number, total: number) {
  return total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
}

export class BoardAnalytics {
  static async getBoardAnalytics(boardId: number): Promise<BoardAnalyticsData> {
    const [board, summary, categories, members, labels] = await Promise.all([
      knex('boards').where({ id: boardId }).first(),
      this.getSummary(boardId),
      this.getCategoryMetrics(boardId),
      this.getMemberMetrics(boardId),
      this.getLabelMetrics(boardId),
    ]);

    return {
      board: {
        id: Number(board.id),
        name: board.name,
        color: board.color,
      },
      generated_at: new Date().toISOString(),
      summary,
      categories,
      members,
      labels,
    };
  }

  static async getSummary(boardId: number): Promise<BoardAnalyticsSummary> {
    const [todoSummary, categorySummary] = await Promise.all([
      knex('todos')
        .leftJoin('categories', 'todos.category_id', 'categories.id')
        .where('todos.board_id', boardId)
        .select(
          knex.raw('COUNT(todos.id) as total_todos'),
          knex.raw(`SUM(${COMPLETED_CASE}) as completed_todos`),
          knex.raw('SUM(CASE WHEN todos.assignee_id IS NULL THEN 1 ELSE 0 END) as unassigned_todos')
        )
        .first(),
      knex('categories')
        .where('board_id', boardId)
        .select(
          knex.raw('COUNT(id) as category_count'),
          knex.raw('SUM(CASE WHEN is_done = true THEN 1 ELSE 0 END) as completed_category_count')
        )
        .first(),
    ]);

    const totalTodos = toNumber(todoSummary?.total_todos);
    const completedTodos = toNumber(todoSummary?.completed_todos);
    const categoryCount = toNumber(categorySummary?.category_count);
    const completedCategoryCount = toNumber(categorySummary?.completed_category_count);

    return {
      total_todos: totalTodos,
      completed_todos: completedTodos,
      active_todos: Math.max(totalTodos - completedTodos, 0),
      unassigned_todos: toNumber(todoSummary?.unassigned_todos),
      completion_rate: toRate(completedTodos, totalTodos),
      category_count: categoryCount,
      completed_category_count: completedCategoryCount,
      active_category_count: Math.max(categoryCount - completedCategoryCount, 0),
    };
  }

  static async getCategoryMetrics(boardId: number): Promise<AnalyticsCategoryMetric[]> {
    const rows = await knex('categories')
      .leftJoin('todos', function joinTodos() {
        this.on('todos.category_id', '=', 'categories.id').andOn('todos.board_id', '=', 'categories.board_id');
      })
      .where('categories.board_id', boardId)
      .groupBy('categories.id', 'categories.name', 'categories.color', 'categories.position', 'categories.is_done')
      .orderBy('categories.position', 'asc')
      .select(
        'categories.id as category_id',
        'categories.name',
        'categories.color',
        'categories.position',
        'categories.is_done',
        knex.raw('COUNT(todos.id) as total_todos'),
        knex.raw(`SUM(${COMPLETED_CASE}) as completed_todos`)
      );

    return rows.map((row) => {
      const total = toNumber(row.total_todos);
      const completed = toNumber(row.completed_todos);

      return {
        category_id: Number(row.category_id),
        name: row.name,
        color: row.color,
        position: Number(row.position),
        is_done: Boolean(row.is_done),
        total_todos: total,
        completed_todos: completed,
        active_todos: Math.max(total - completed, 0),
        completion_rate: toRate(completed, total),
      };
    });
  }

  static async getMemberMetrics(boardId: number): Promise<AnalyticsMemberMetric[]> {
    const [memberRows, categoryRows] = await Promise.all([
      knex('board_members')
        .join('users', 'users.id', 'board_members.user_id')
        .leftJoin('todos', function joinTodos() {
          this.on('todos.assignee_id', '=', 'users.id').andOnVal('todos.board_id', '=', boardId);
        })
        .leftJoin('categories', 'categories.id', 'todos.category_id')
        .where('board_members.board_id', boardId)
        .groupBy('users.id', 'users.first_name', 'users.last_name', 'users.avatar_url')
        .select(
          'users.id as user_id',
          'users.first_name',
          'users.last_name',
          'users.avatar_url',
          knex.raw('COUNT(todos.id) as assigned_total_todos'),
          knex.raw(`SUM(${COMPLETED_CASE}) as assigned_completed_todos`)
        ),
      knex('board_members')
        .join('users', 'users.id', 'board_members.user_id')
        .join('todos', function joinTodos() {
          this.on('todos.assignee_id', '=', 'users.id').andOnVal('todos.board_id', '=', boardId);
        })
        .join('categories', 'categories.id', 'todos.category_id')
        .where('board_members.board_id', boardId)
        .groupBy('users.id', 'categories.id')
        .select(
          'users.id as user_id',
          'categories.id as category_id',
          knex.raw('COUNT(todos.id) as total_todos'),
          knex.raw(`SUM(${COMPLETED_CASE}) as completed_todos`)
        ),
    ]);

    const categoryMap = categoryRows.reduce<Record<number, AnalyticsMemberMetric['by_category']>>((acc, row) => {
      const userId = Number(row.user_id);
      if (!acc[userId]) {
        acc[userId] = [];
      }

      acc[userId].push({
        category_id: Number(row.category_id),
        total_todos: toNumber(row.total_todos),
        completed_todos: toNumber(row.completed_todos),
      });

      return acc;
    }, {});

    return memberRows
      .map((row) => {
        const total = toNumber(row.assigned_total_todos);
        const completed = toNumber(row.assigned_completed_todos);

        return {
          user_id: Number(row.user_id),
          first_name: row.first_name,
          last_name: row.last_name,
          avatar_url: row.avatar_url,
          assigned_total_todos: total,
          assigned_completed_todos: completed,
          assigned_active_todos: Math.max(total - completed, 0),
          completion_rate: toRate(completed, total),
          by_category: categoryMap[Number(row.user_id)] ?? [],
        };
      })
      .sort((left, right) => {
        if (right.assigned_completed_todos !== left.assigned_completed_todos) {
          return right.assigned_completed_todos - left.assigned_completed_todos;
        }

        if (right.completion_rate !== left.completion_rate) {
          return right.completion_rate - left.completion_rate;
        }

        if (right.assigned_total_todos !== left.assigned_total_todos) {
          return right.assigned_total_todos - left.assigned_total_todos;
        }

        return `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`);
      });
  }

  static async getLabelMetrics(boardId: number): Promise<AnalyticsLabelMetric[]> {
    const [labelRows, categoryRows] = await Promise.all([
      knex('labels')
        .leftJoin('todo_labels', 'todo_labels.label_id', 'labels.id')
        .leftJoin('todos', function joinTodos() {
          this.on('todos.id', '=', 'todo_labels.todo_id').andOnVal('todos.board_id', '=', boardId);
        })
        .leftJoin('categories', 'categories.id', 'todos.category_id')
        .where('labels.board_id', boardId)
        .groupBy('labels.id', 'labels.name', 'labels.color')
        .select(
          'labels.id as label_id',
          'labels.name',
          'labels.color',
          knex.raw('COUNT(todos.id) as total_todos'),
          knex.raw(`SUM(${COMPLETED_CASE}) as completed_todos`)
        ),
      knex('labels')
        .join('todo_labels', 'todo_labels.label_id', 'labels.id')
        .join('todos', function joinTodos() {
          this.on('todos.id', '=', 'todo_labels.todo_id').andOnVal('todos.board_id', '=', boardId);
        })
        .join('categories', 'categories.id', 'todos.category_id')
        .where('labels.board_id', boardId)
        .groupBy('labels.id', 'categories.id')
        .select(
          'labels.id as label_id',
          'categories.id as category_id',
          knex.raw('COUNT(todos.id) as total_todos'),
          knex.raw(`SUM(${COMPLETED_CASE}) as completed_todos`)
        ),
    ]);

    const categoryMap = categoryRows.reduce<Record<number, AnalyticsLabelMetric['by_category']>>((acc, row) => {
      const labelId = Number(row.label_id);
      if (!acc[labelId]) {
        acc[labelId] = [];
      }

      acc[labelId].push({
        category_id: Number(row.category_id),
        total_todos: toNumber(row.total_todos),
        completed_todos: toNumber(row.completed_todos),
      });

      return acc;
    }, {});

    return labelRows
      .map((row) => {
        const total = toNumber(row.total_todos);
        const completed = toNumber(row.completed_todos);

        return {
          label_id: Number(row.label_id),
          name: row.name,
          color: row.color,
          total_todos: total,
          completed_todos: completed,
          active_todos: Math.max(total - completed, 0),
          completion_rate: toRate(completed, total),
          by_category: categoryMap[Number(row.label_id)] ?? [],
        };
      })
      .sort((left, right) => {
        if (right.completed_todos !== left.completed_todos) {
          return right.completed_todos - left.completed_todos;
        }

        if (right.completion_rate !== left.completion_rate) {
          return right.completion_rate - left.completion_rate;
        }

        return left.name.localeCompare(right.name);
      });
  }
}
