'use client'

import { DndContext, DragOverlay, DragEndEvent, DragStartEvent, closestCenter, useDroppable } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Save } from 'lucide-react'
import { useModal } from '@/context/ModalManager'
import { useMemo, useState } from 'react'

import BoardViewContext from '@/context/BoardViewContext'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

import DraggableTodo from '../DraggableTodo'
import TodoCard from '../TodoCard'

export default function BoardKanbanView({
  boardColor,
  categoryOrder,
  categoryMap,
  categorizedTodos,
  isManagingCategories,
  onTodoClick,
  onTodoMove,
  onStageCategoryOrder,
  onSaveCategoryChanges,
  hasUnsavedCategoryChanges,
}: {
  boardColor: string
  categoryOrder: number[]
  categoryMap: Record<number, CategoryBaseData>
  categorizedTodos: Record<number, TodoWithLabels[]>
  isManagingCategories: boolean
  onTodoClick: (todo: TodoWithLabels) => void
  onTodoMove: (todo: TodoWithLabels, categoryId: number) => void
  onStageCategoryOrder: (order: number[]) => void
  onSaveCategoryChanges: () => Promise<void>
  hasUnsavedCategoryChanges: boolean
}) {
  const [activeTodo, setActiveTodo] = useState<TodoWithLabels | null>(null)

  const orderedCategories = useMemo(
    () =>
      categoryOrder
        .map((id) => categoryMap[id])
        .filter((category): category is CategoryBaseData => Boolean(category)),
    [categoryMap, categoryOrder]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as TodoWithLabels | undefined
    setActiveTodo(todo ?? null)
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = categoryOrder.indexOf(Number(active.id))
    const overIndex = categoryOrder.indexOf(Number(over.id))
    if (activeIndex === -1 || overIndex === -1) return

    onStageCategoryOrder(arrayMove(categoryOrder, activeIndex, overIndex))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)

    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      onTodoMove(todo, overCategoryId)
    }

    setActiveTodo(null)
  }

  return (
    <BoardViewContext.Provider value={{ hideTodos: false, setHideTodos: () => {} }}>
      {isManagingCategories ? (
        <section className="glass-panel mb-5 flex flex-col gap-4 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Category Management</p>
            <p className="mt-2 text-sm leading-6 app-text-muted">
              Drag lanes horizontally to reorder them, then click a lane to edit its details without leaving kanban.
            </p>
          </div>
          {hasUnsavedCategoryChanges ? (
            <button onClick={onSaveCategoryChanges} className="glass-button glass-button-primary">
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          ) : null}
        </section>
      ) : null}

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={isManagingCategories ? () => {} : handleDragStart}
        onDragCancel={() => setActiveTodo(null)}
        onDragEnd={isManagingCategories ? handleCategoryDragEnd : handleDragEnd}
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="flex min-w-max items-start gap-7 px-2 py-1">
            {isManagingCategories ? (
              <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                {orderedCategories.map((category) => (
                  <SortableKanbanCategory
                    key={category.id}
                    category={category}
                    boardColor={boardColor}
                    todoCount={categorizedTodos[category.id]?.length ?? 0}
                  />
                ))}
              </SortableContext>
            ) : (
              orderedCategories.map((category) => (
                <KanbanColumn
                  key={category.id}
                  category={category}
                  boardColor={boardColor}
                  todos={categorizedTodos[category.id] || []}
                  onTodoClick={onTodoClick}
                />
              ))
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTodo && !isManagingCategories ? (
            <div className="w-[320px] cursor-grabbing">
              <TodoCard todo={activeTodo} elevated />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </BoardViewContext.Provider>
  )
}

function KanbanColumn({
  category,
  boardColor,
  todos,
  onTodoClick,
}: {
  category: CategoryBaseData
  boardColor: string
  todos: TodoWithLabels[]
  onTodoClick: (todo: TodoWithLabels) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id })

  return (
    <section
      ref={setNodeRef}
      className="glass-panel flex w-[368px] shrink-0 flex-col rounded-[1.75rem] p-6"
      style={
        isOver
          ? {
              background: `linear-gradient(180deg, color-mix(in srgb, ${category.color || boardColor} 16%, var(--app-panel-strong)), var(--app-panel))`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: category.color || boardColor,
                boxShadow: `0 0 0 8px color-mix(in srgb, ${category.color || boardColor} 18%, transparent)`,
              }}
            />
            <h2 className="text-xl font-semibold">{category.name}</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="app-badge">{todos.length} items</span>
            {category.is_done ? <span className="app-badge">Done lane</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-[10rem] space-y-3">
        {todos.length > 0 ? (
          todos.map((todo) => <DraggableTodo key={todo.id} todo={todo} onClick={() => onTodoClick(todo)} />)
        ) : (
          <div
            className="rounded-[1.4rem] border border-dashed px-4 py-5 text-center text-sm leading-6 app-text-muted"
            style={{ borderColor: 'var(--app-border)' }}
          >
            Drop a task here to move it into this lane.
          </div>
        )}
      </div>
    </section>
  )
}

function SortableKanbanCategory({
  category,
  boardColor,
  todoCount,
}: {
  category: CategoryBaseData
  boardColor: string
  todoCount: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })
  const { openModal } = useModal()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        type="button"
        onClick={() => openModal('CATEGORY', category)}
        className="glass-panel flex w-[368px] shrink-0 flex-col rounded-[1.75rem] p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 rounded-full"
            style={{
              backgroundColor: category.color || boardColor,
              boxShadow: `0 0 0 8px color-mix(in srgb, ${category.color || boardColor} 18%, transparent)`,
            }}
          />
          <h2 className="text-xl font-semibold">{category.name}</h2>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="app-badge">{todoCount} items</span>
          {category.is_done ? <span className="app-badge">Done lane</span> : null}
          <span className="app-badge">Drag to reorder</span>
        </div>

        <div
          className="mt-5 rounded-[1.4rem] border border-dashed p-5 text-sm leading-6 app-text-muted"
          style={{ borderColor: 'var(--app-border)' }}
        >
          Click this lane to edit its name, color, or completion state. Drag the lane to change ordering.
        </div>
      </button>
    </div>
  )
}
