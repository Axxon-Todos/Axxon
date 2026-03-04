'use client'

import dayjs from 'dayjs'
import { CalendarDays, Clock3, FolderKanban, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'

import Calendar from '@/components/common/calendar'
import { isTodoEffectivelyComplete } from '@/lib/utils/todoCompletion'

import type { BoardBaseData } from '@/lib/types/boardTypes'
import type { BoardCalendarTodo, BoardCalendarTodosByDate } from '@/lib/types/boardViewTypes'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

const TODAY_KEY = dayjs().format('YYYY-MM-DD')

export default function BoardCalendarView({
  board,
  categoriesById,
  todos,
  onTodoClick,
}: {
  board: BoardBaseData
  categoriesById: Record<number, CategoryBaseData>
  todos: TodoWithLabels[]
  onTodoClick: (todo: TodoWithLabels) => void
}) {
  const [selectedDate, setSelectedDate] = useState(TODAY_KEY)

  const { todosByDate, unscheduledTodos } = useMemo(() => {
    const nextTodosByDate: BoardCalendarTodosByDate = {}
    const nextUnscheduled: BoardCalendarTodo[] = []

    todos.forEach((todo) => {
      const category = todo.category_id ? categoriesById[todo.category_id] : undefined
      const calendarTodo: BoardCalendarTodo = {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDate: todo.due_date,
        priority: todo.priority,
        categoryId: todo.category_id,
        categoryName: category?.name,
        color: category?.color || board.color || '#2563eb',
        isComplete: isTodoEffectivelyComplete(todo.is_complete, category?.is_done),
        sourceTodo: todo,
      }

      if (!todo.due_date) {
        nextUnscheduled.push(calendarTodo)
        return
      }

      const dateKey = dayjs(todo.due_date).format('YYYY-MM-DD')
      if (!nextTodosByDate[dateKey]) {
        nextTodosByDate[dateKey] = []
      }

      nextTodosByDate[dateKey].push(calendarTodo)
    })

    return {
      todosByDate: nextTodosByDate,
      unscheduledTodos: nextUnscheduled.sort((a, b) => a.title.localeCompare(b.title)),
    }
  }, [board.color, categoriesById, todos])

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Calendar
        todosByDate={todosByDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onSelectTodo={(todo) => onTodoClick((todo as BoardCalendarTodo).sourceTodo)}
      />

      <section className="glass-panel-strong rounded-[2rem] p-5 sm:p-6">
        <div>
          <p className="app-kicker">Unscheduled</p>
          <h2 className="mt-2 text-2xl font-semibold">Tasks without due dates</h2>
          <p className="mt-2 text-sm leading-6 app-text-muted">
            Keep quick-access editing for work that has not been placed on the calendar yet.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {unscheduledTodos.length > 0 ? (
            unscheduledTodos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => onTodoClick(todo.sourceTodo)}
                className="glass-panel w-full rounded-[1.4rem] p-4 text-left hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: todo.color || '#2563eb' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{todo.title}</p>
                    {todo.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 app-text-muted">{todo.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {todo.categoryName ? (
                        <span className="app-badge">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {todo.categoryName}
                        </span>
                      ) : null}
                      <span className="app-badge">
                        <Clock3 className="h-3.5 w-3.5" />
                        No due date
                      </span>
                      {todo.isComplete ? (
                        <span className="app-badge">
                          <Tags className="h-3.5 w-3.5" />
                          Complete
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div
              className="rounded-[1.5rem] border border-dashed p-5 text-sm leading-6 app-text-muted"
              style={{ borderColor: 'var(--app-border)' }}
            >
              Every task on this board currently has a scheduled due date.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[var(--app-border)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-[var(--app-accent)]" />
            Calendar Notes
          </div>
          <p className="mt-3 text-sm leading-6 app-text-muted">
            Click any date to inspect its agenda, then open a task to update due date, completion, labels, or
            category from the shared drawer.
          </p>
        </div>
      </section>
    </div>
  )
}
