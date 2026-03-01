import type { TodoWithLabels } from '@/lib/types/todoTypes'

export type BoardDisplayView = 'list' | 'kanban' | 'calendar'

export const BOARD_VIEW_ORDER: BoardDisplayView[] = ['list', 'kanban', 'calendar']

export type BoardCalendarTodo = {
  id: number
  title: string
  description?: string
  dueDate?: string
  priority?: number
  categoryId?: number
  categoryName?: string
  color?: string
  isComplete?: boolean
  sourceTodo: TodoWithLabels
}

export type BoardCalendarTodosByDate = Record<string, BoardCalendarTodo[]>
