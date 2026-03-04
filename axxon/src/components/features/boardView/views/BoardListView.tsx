'use client'

import { DndContext, DragOverlay, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'

import BoardViewContext from '@/context/BoardViewContext'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'

import DraggableCategory from '../DraggableCategory'
import DroppableColumn from '../DroppableColumn'
import TodoCard from '../TodoCard'

export default function BoardListView({
  categoryOrder,
  categoryMap,
  categorizedTodos,
  isManagingCategories,
  onToggleManageCategories,
  onTodoClick,
  onTodoMove,
  onStageCategoryOrder,
  onSaveCategoryChanges,
  hasUnsavedCategoryChanges,
}: {
  categoryOrder: number[]
  categoryMap: Record<number, CategoryBaseData>
  categorizedTodos: Record<number, TodoWithLabels[]>
  isManagingCategories: boolean
  onToggleManageCategories: () => void
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

  const handleTodoDragEnd = (event: DragEndEvent) => {
    const todo = activeTodo
    const overCategoryId = Number(event.over?.id)

    if (todo && overCategoryId && overCategoryId !== todo.category_id) {
      onTodoMove(todo, overCategoryId)
    }

    setActiveTodo(null)
  }

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = categoryOrder.indexOf(Number(active.id))
    const overIndex = categoryOrder.indexOf(Number(over.id))
    if (activeIndex === -1 || overIndex === -1) return

    onStageCategoryOrder(arrayMove(categoryOrder, activeIndex, overIndex))
  }

  return (
    <BoardViewContext.Provider value={{ hideTodos: isManagingCategories, setHideTodos: onToggleManageCategories }}>
      <div className="space-y-5">
        {isManagingCategories ? (
          <section className="glass-panel flex flex-col gap-4 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-kicker">Category Management</p>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                Drag categories to reorder them, click a lane to edit its settings, then save the changes when
                you are ready.
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
          onDragEnd={isManagingCategories ? handleCategoryDragEnd : handleTodoDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div className="space-y-5">
            {isManagingCategories ? (
              <SortableContext items={categoryOrder} strategy={verticalListSortingStrategy}>
                {orderedCategories.map((category) => (
                  <DraggableCategory
                    key={category.id}
                    category={category}
                    todoCount={categorizedTodos[category.id]?.length ?? 0}
                    onTodoClick={onTodoClick}
                  />
                ))}
              </SortableContext>
            ) : (
              orderedCategories.map((category) => (
                <DroppableColumn
                  key={category.id}
                  categoryId={category.id}
                  categoryName={category.name}
                  categoryColor={category.color}
                  isDone={Boolean(category.is_done)}
                  todoCount={categorizedTodos[category.id]?.length ?? 0}
                  todos={categorizedTodos[category.id] || []}
                  onTodoClick={onTodoClick}
                />
              ))
            )}
          </div>

          <DragOverlay>
            {activeTodo ? (
              <div className="w-[min(100%,420px)] cursor-grabbing">
                <TodoCard todo={activeTodo} elevated />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </BoardViewContext.Provider>
  )
}
