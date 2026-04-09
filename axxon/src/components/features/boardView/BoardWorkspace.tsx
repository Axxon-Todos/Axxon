// Coordinates board data, modal flows, and view switching for the board workspace shell.
'use client'

import dayjs from 'dayjs'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import Modal from '@/components/ui/Modal'
import UpdateCategoryForm from '@/components/forms/CategoryForm'
import { useModal } from '@/context/ModalManager'
import { useBoardRealtime } from '@/hooks/useBoardRealtime'
import { useOrganizationRouteParams } from '@/hooks/useOrganizationRouteParams'
import { useSocket } from '@/hooks/useSocket'
import { fetchBoard } from '@/lib/api/boards/getSingleBoard'
import { fetchCategories } from '@/lib/api/categories/getCategories'
import { fetchLabels } from '@/lib/api/labels/getLabels'
import { fetchTodosWithLabels } from '@/lib/api/todos/getTodosWithLabels'
import { useDeleteCategory } from '@/lib/mutations/useDeleteCategory'
import { useReorderCategories } from '@/lib/mutations/useReorderCategories'
import { useUpdateCategory } from '@/lib/mutations/UseUpdateCategory'
import { useUpdateTodoMutation } from '@/lib/mutations/useUpdateTodo'
import type { CategoryBaseData } from '@/lib/types/categoryTypes'
import type { SprintBaseData } from '@/lib/types/sprintTypes'
import { BOARD_VIEW_ORDER, type BoardDisplayView } from '@/lib/types/boardViewTypes'
import type { TodoWithLabels } from '@/lib/types/todoTypes'
import { isTodoEffectivelyComplete } from '@/lib/utils/todoCompletion'

import BoardHeader from './BoardHeader'
import BoardCalendarView from './views/BoardCalendarView'
import BoardKanbanView from './views/BoardKanbanView'
import BoardListView from './views/BoardListView'

function compareLaneTodoOrder(left: TodoWithLabels, right: TodoWithLabels) {
  const leftCreatedAt = left.created_at ? new Date(left.created_at).getTime() : Number.NaN
  const rightCreatedAt = right.created_at ? new Date(right.created_at).getTime() : Number.NaN
  const leftHasCreatedAt = Number.isFinite(leftCreatedAt)
  const rightHasCreatedAt = Number.isFinite(rightCreatedAt)

  if (leftHasCreatedAt && rightHasCreatedAt && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt
  }

  if (leftHasCreatedAt !== rightHasCreatedAt) {
    return leftHasCreatedAt ? -1 : 1
  }

  return left.id - right.id
}

export default function BoardWorkspace({
  boardId,
  selectedSprint = null,
}: {
  boardId: string
  selectedSprint?: SprintBaseData | null
}) {
  const { organizationId } = useOrganizationRouteParams()
  const socketRef = useSocket(boardId)
  useBoardRealtime(organizationId, boardId, socketRef)

  const [activeView, setActiveView] = useState<BoardDisplayView>('list')
  const [transitionDirection, setTransitionDirection] = useState(1)
  const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [categoryOrder, setCategoryOrder] = useState<number[]>([])
  const [unsavedOrder, setUnsavedOrder] = useState<number[] | null>(null)
  const [unsavedCategories, setUnsavedCategories] = useState<Record<number, Partial<CategoryBaseData>>>({})

  const { modalState, openModal, closeModal } = useModal()
  const shouldReduceMotion = useReducedMotion()

  const updateTodo = useUpdateTodoMutation(organizationId, boardId)
  const reorderCategories = useReorderCategories(organizationId, boardId)
  const updateCategory = useUpdateCategory(organizationId, boardId)
  const deleteCategory = useDeleteCategory(organizationId, boardId)

  const { data: board } = useQuery({
    queryKey: ['board', organizationId, boardId],
    queryFn: () => fetchBoard(organizationId, boardId),
    enabled: Boolean(organizationId),
  })
  const { data: categories } = useQuery<CategoryBaseData[]>({
    queryKey: ['categories', organizationId, boardId],
    queryFn: () => fetchCategories(organizationId, boardId),
    enabled: Boolean(organizationId),
  })
  const { data: labels } = useQuery({
    queryKey: ['labels', organizationId, boardId],
    queryFn: () => fetchLabels(organizationId, boardId),
    enabled: Boolean(organizationId),
  })
  const { data: todos } = useQuery<TodoWithLabels[]>({
    queryKey: ['todos', organizationId, boardId],
    queryFn: () => fetchTodosWithLabels(organizationId, boardId),
    enabled: Boolean(organizationId),
  })
  const sprintScopedTodos = useMemo(() => {
    if (!todos) {
      return []
    }

    if (!selectedSprint) {
      return todos
    }

    return todos.filter((todo) => todo.sprint_id === selectedSprint.id)
  }, [selectedSprint, todos])

  useEffect(() => {
    if (categories && categories.length && categoryOrder.length === 0) {
      setCategoryOrder(categories.map((category) => category.id))
    }
  }, [categories, categoryOrder.length])

  const categoryMap = useMemo(() => {
    if (!categories) return {}

    return categories.reduce(
      (acc, category) => {
        const overrides = unsavedCategories[category.id] || {}
        acc[category.id] = { ...category, ...overrides }
        return acc
      },
      {} as Record<number, CategoryBaseData>
    )
  }, [categories, unsavedCategories])

  const categorizedTodos = useMemo(() => {
    if (!categories) return {}

    return categories.reduce(
      (acc, category) => {
        acc[category.id] = sprintScopedTodos
          .filter((todo) => todo.category_id === category.id)
          .sort(compareLaneTodoOrder)
        return acc
      },
      {} as Record<number, TodoWithLabels[]>
    )
  }, [categories, sprintScopedTodos])

  const dueSoonCount = sprintScopedTodos.filter((todo) => {
    const category = todo.category_id ? categoryMap[todo.category_id] : undefined
    if (!todo.due_date || isTodoEffectivelyComplete(todo.is_complete, category?.is_done)) return false
    const dueDate = dayjs(todo.due_date)
    return dueDate.isAfter(dayjs().subtract(1, 'day'), 'day') && dueDate.diff(dayjs(), 'day') <= 7
  }).length

  const completedCount = sprintScopedTodos.filter((todo) => {
    const category = todo.category_id ? categoryMap[todo.category_id] : undefined
    return isTodoEffectivelyComplete(todo.is_complete, category?.is_done)
  }).length

  const hasUnsavedCategoryChanges = Boolean(unsavedOrder || Object.keys(unsavedCategories).length > 0)
  const canAddTodo = !selectedSprint?.archived_at

  const resetCategoryManagement = () => {
    setIsManagingCategories(false)
    setUnsavedCategories({})
    setUnsavedOrder(null)

    if (categories) {
      setCategoryOrder(categories.map((category) => category.id))
    }
  }

  const handleChangeView = (nextView: BoardDisplayView) => {
    if (nextView === activeView) return

    const currentIndex = BOARD_VIEW_ORDER.indexOf(activeView)
    const nextIndex = BOARD_VIEW_ORDER.indexOf(nextView)
    setTransitionDirection(nextIndex > currentIndex ? 1 : -1)
    setActiveView(nextView)

    if (nextView === 'calendar') {
      resetCategoryManagement()
    }
  }

  const handleToggleManageCategories = () => {
    if (isManagingCategories) {
      resetCategoryManagement()
      return
    }

    setIsManagingCategories(true)
  }

  const handleMoveTodo = (todo: TodoWithLabels, categoryId: number) => {
    updateTodo.mutate({ todoId: todo.id, data: { category_id: categoryId } })
  }

  const handleAddTodo = (categoryId?: number) => {
    openModal('ADD_TODO', {
      boardId: Number(boardId),
      sprintId: selectedSprint?.archived_at ? null : selectedSprint?.id ?? null,
      categoryId,
    })
  }

  const handleSaveCategoryChanges = async () => {
    try {
      const updatePromises = Object.entries(unsavedCategories).map(([id, data]) =>
        updateCategory.mutateAsync({ categoryId: Number(id), data })
      )

      if (unsavedOrder) {
        await reorderCategories.mutateAsync(unsavedOrder.map(String))
      }

      await Promise.all(updatePromises)
      setUnsavedCategories({})
      setUnsavedOrder(null)
    } catch (error) {
      console.error('Failed to save category changes', error)
    }
  }

  const handleOpenTodo = (todo: TodoWithLabels) => {
    openModal('UPDATE_TODO', { boardId: Number(boardId), todo })
  }

  if (!board || !categories || !todos || !labels) {
    return (
      <div className="app-page w-full">
        <section className="glass-panel-strong rounded-[2rem] p-8">
          <p className="app-kicker">Board Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading board...</h1>
        </section>
      </div>
    )
  }

  const motionVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (direction: number) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
        animate: { opacity: 1, x: 0 },
        exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
      }

  return (
    <div className="flex flex-col gap-6">
      <div className="app-page w-full">
        <BoardHeader
          boardId={boardId}
          board={board}
          categoryCount={categories.length}
          todoCount={sprintScopedTodos.length}
          labelCount={labels.length}
          dueSoonCount={dueSoonCount}
          completedCount={completedCount}
          activeView={activeView}
          onChangeView={handleChangeView}
          onAddTodo={() => handleAddTodo()}
          isManagingCategories={isManagingCategories}
          onToggleManageCategories={handleToggleManageCategories}
          selectedSprint={selectedSprint}
          canAddTodo={canAddTodo}
        />
      </div>

      {modalState.type === 'CATEGORY' ? (
        <Modal isOpen onClose={closeModal} title="Edit Category">
          <UpdateCategoryForm
            category={modalState.payload}
            onSave={(updatedProps: Partial<CategoryBaseData>) => {
              setUnsavedCategories((prev) => ({
                ...prev,
                [modalState.payload.id]: { ...prev[modalState.payload.id], ...updatedProps },
              }))
              closeModal()
            }}
            onDelete={(id: number) => {
              setCategoryOrder((prev) => {
                const next = prev.filter((categoryId) => categoryId !== id)
                setUnsavedOrder(next)
                return next
              })
              setUnsavedCategories((prev) => {
                const copy = { ...prev }
                delete copy[id]
                return copy
              })
              deleteCategory.mutate(id)
              closeModal()
            }}
            onClose={closeModal}
          />
        </Modal>
      ) : null}

      <AnimatePresence initial={false} mode="wait" custom={transitionDirection}>
        {activeView === 'list' ? (
          <motion.div
            key="list"
            className="app-page min-w-0 w-full"
            custom={transitionDirection}
            variants={motionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="glass-panel relative rounded-[2rem] p-4 sm:p-5">
              <BoardListView
                categoryOrder={categoryOrder}
                categoryMap={categoryMap}
                categorizedTodos={categorizedTodos}
                isManagingCategories={isManagingCategories}
                onToggleManageCategories={handleToggleManageCategories}
                onTodoClick={handleOpenTodo}
                onTodoMove={handleMoveTodo}
                onStageCategoryOrder={(nextOrder) => {
                  setCategoryOrder(nextOrder)
                  setUnsavedOrder(nextOrder)
                }}
                onSaveCategoryChanges={handleSaveCategoryChanges}
                hasUnsavedCategoryChanges={hasUnsavedCategoryChanges}
                canAddTodo={canAddTodo}
                onCreateTodo={handleAddTodo}
              />
            </div>
          </motion.div>
        ) : null}

        {activeView === 'kanban' ? (
          <motion.div
            key="kanban"
            className="-mx-4 min-w-0 sm:-mx-6 lg:-mx-8"
            custom={transitionDirection}
            variants={motionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <BoardKanbanView
              boardColor={board.color || '#2563eb'}
              categoryOrder={categoryOrder}
              categoryMap={categoryMap}
              categorizedTodos={categorizedTodos}
              isManagingCategories={isManagingCategories}
              onTodoClick={handleOpenTodo}
              onTodoMove={handleMoveTodo}
              onStageCategoryOrder={(nextOrder) => {
                setCategoryOrder(nextOrder)
                setUnsavedOrder(nextOrder)
              }}
              onSaveCategoryChanges={handleSaveCategoryChanges}
              hasUnsavedCategoryChanges={hasUnsavedCategoryChanges}
              canAddTodo={canAddTodo}
              onCreateTodo={handleAddTodo}
            />
          </motion.div>
        ) : null}

        {activeView === 'calendar' ? (
          <motion.div
            key="calendar"
            className="app-page min-w-0 w-full"
            custom={transitionDirection}
            variants={motionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="glass-panel relative rounded-[2rem] p-4 sm:p-5">
              <BoardCalendarView
                board={board}
                categoriesById={categoryMap}
                todos={sprintScopedTodos}
                onTodoClick={handleOpenTodo}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
