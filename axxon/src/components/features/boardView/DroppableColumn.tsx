'use client'

import { useDroppable } from '@dnd-kit/core'

import type { TodoWithLabels } from '@/lib/types/todoTypes'

import DraggableTodo from './DraggableTodo'

export default function DroppableColumn({
  categoryId,
  categoryName,
  categoryColor,
  isDone,
  todoCount,
  todos,
  onTodoClick,
  managementMode = false,
}: {
  categoryId: number
  categoryName: string
  categoryColor?: string
  isDone?: boolean
  todoCount?: number
  todos: TodoWithLabels[]
  onTodoClick: (todo: TodoWithLabels) => void
  managementMode?: boolean
}) {
  const { setNodeRef } = useDroppable({ id: categoryId })

  return (
    <section ref={setNodeRef} className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: categoryColor || '#2563eb',
                boxShadow: `0 0 0 8px color-mix(in srgb, ${categoryColor || '#2563eb'} 18%, transparent)`,
              }}
            />
            <h2 className="truncate text-2xl font-semibold">{categoryName}</h2>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="app-badge">{todoCount ?? todos.length} items</span>
            {isDone && <span className="app-badge">Done lane</span>}
            {managementMode && <span className="app-badge">Drag to reorder</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {managementMode ? (
          <div
            className="rounded-[1.4rem] border border-dashed p-5 text-sm leading-6 app-text-muted"
            style={{ borderColor: 'var(--app-border)' }}
          >
            Click this lane to edit its name, color, or completion status. Drag the entire lane to change
            ordering.
          </div>
        ) : todos.length > 0 ? (
          todos.map((todo) => (
            <DraggableTodo
              key={todo.id}
              todo={todo}
              onClick={() => onTodoClick(todo)}
            />
          ))
        ) : (
          <div
            className="rounded-[1.4rem] border border-dashed p-5 text-sm leading-6 app-text-muted"
            style={{ borderColor: 'var(--app-border)' }}
          >
            No todos in this category yet.
          </div>
        )}
      </div>
    </section>
  )
}
