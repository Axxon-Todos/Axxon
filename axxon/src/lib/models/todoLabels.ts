import knex from '@/lib/db/db'
import type {
  AddLabelToTodo,
  FilterTodosByLabel,
  GetLabelsOnTodo,
  RemoveLabelFromTodo,
  TodoLabelsBaseData,
} from '../types/todoLabelTypes'
import type { LabelBaseData } from '../types/labelTypes';
import type { TodoAssigneeSummary, TodoBaseData, TodoWithLabels } from '../types/todoTypes';
import { Users } from './users';
import { Labels } from './labels';
import { Todos } from './todos';

//class for handling joined todos and labels
export class TodoLabels { 
  private static buildAssigneeSummary = (user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }): TodoAssigneeSummary => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;

    return {
      id: user.id,
      name,
      avatar_url: user.avatar_url,
    };
  };

  private static hydrateTodos = async (boardId: number, todos: TodoBaseData[]): Promise<TodoWithLabels[]> => {
    if (!todos.length) {
      return [];
    }

    const todoIds = todos.map((todo) => todo.id);
    const assigneeIds = Array.from(
      new Set(
        todos
          .map((todo) => todo.assignee_id)
          .filter((assigneeId): assigneeId is number => typeof assigneeId === 'number')
      )
    );

    const [todoLabels, allLabels, assignees] = await Promise.all([
      knex('todo_labels').whereIn('todo_id', todoIds),
      Labels.listAllLabelsInBoard({ board_id: boardId }),
      Users.listUsersByIds(assigneeIds),
    ]);

    const labelMap = allLabels.reduce((acc, label) => {
      acc[label.id] = label;
      return acc;
    }, {} as Record<number, LabelBaseData>);

    const assigneeMap = assignees.reduce((acc, user) => {
      acc[user.id] = TodoLabels.buildAssigneeSummary(user);
      return acc;
    }, {} as Record<number, TodoAssigneeSummary>);

    return todos.map((todo) => ({
      ...todo,
      labels: todoLabels
        .filter((relation) => relation.todo_id === todo.id)
        .map((relation) => labelMap[relation.label_id])
        .filter((label): label is LabelBaseData => Boolean(label)),
      assignee: typeof todo.assignee_id === 'number' ? assigneeMap[todo.assignee_id] ?? null : null,
    }));
  };

  static addLabelToTodo = async (data: AddLabelToTodo ): Promise<TodoLabelsBaseData> => {
        const [todoLabel] = await knex('todo_labels')
        .insert({
            todo_id: data.todo_id,
            label_id: data.label_id
        })
        .returning('*');
        
        return todoLabel;
  };

  static removeLabelFromTodo = async (data: RemoveLabelFromTodo ): Promise<TodoLabelsBaseData | null> => {
        const [todoLabel] = await knex('todo_labels')
        .where({
            todo_id: data.todo_id,
            label_id: data.label_id
        })
        .del()
        .returning('*');

        return todoLabel || null;
  };

  //Displays all labels attached to a todo based on id
  static getLabelsForTodo = async (data: GetLabelsOnTodo): Promise<LabelBaseData[]> => {
        return await knex('labels')
        .join('todo_labels', 'labels.id', 'todo_labels.label_id')// Join on label_id to connect todos and labels
        .where({'todo_labels.todo_id': data.todo_id})            // Filter by the todo_id
        .select('labels.*');                                     // Return full label data
  };

  static filterTodosByLabel = async (data: FilterTodosByLabel): Promise<TodoBaseData[]> => {
        return await knex('todos')
        .join('todo_labels', 'todos.id','todo_labels.todo_id')
        .where({'todo_labels.label_id': data.label_id})
        .select('todos.*');
  };

  // Fetch todos with their labels for a specific board
  static async getTodosWithLabels(boardId: number): Promise<TodoWithLabels[]> {
    const todos = await Todos.listTodosInBoard({ board_id: boardId });
    return TodoLabels.hydrateTodos(boardId, todos);
  };

  // Fetch todo by ID with labels
  static async getTodoByIdWithLabels(
    todoId: number,
    boardId: number
  ): Promise<TodoWithLabels | null> {
    const todo = await Todos.getTodoById({ id: todoId, board_id: boardId });
    if (!todo) return null;

    const [hydratedTodo] = await TodoLabels.hydrateTodos(boardId, [todo]);
    return hydratedTodo ?? null;
  }

}
